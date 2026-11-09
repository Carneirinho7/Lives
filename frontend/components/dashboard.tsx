"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { Stream, User } from "@/shared/types";
import { PlayerEmbed } from "@/frontend/components/player-embed";
import { createClient } from "@/frontend/lib/supabase/client";

type DashboardData = { user: User; streams: Stream[] };

async function readApiJson(response: Response): Promise<unknown> {
  const body = await response.text();
  if (!body.trim()) {
    throw new Error(`A API respondeu sem conteúdo (HTTP ${response.status}).`);
  }
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new Error(`A API respondeu em formato inválido (HTTP ${response.status}).`);
  }
}

function apiError(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") {
    return payload.error;
  }
  return fallback;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [activeFilter, setActiveFilter] = useState("Todas");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [removedReady, setRemovedReady] = useState(false);
  const [lastRemoved, setLastRemoved] = useState<Stream | null>(null);
  const [customStreams, setCustomStreams] = useState<Stream[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [liveUrl, setLiveUrl] = useState("");
  const [addError, setAddError] = useState("");
  const [adminSetupOpen, setAdminSetupOpen] = useState(false);
  const [adminSetupToken, setAdminSetupToken] = useState("");
  const [adminSetupError, setAdminSetupError] = useState("");
  const [adminSetupBusy, setAdminSetupBusy] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("liveloot-removed-streams");
      if (saved) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Hydrate persisted browser preferences once on mount.
        setRemovedIds(JSON.parse(saved) as string[]);
      }
      const savedCustom = window.localStorage.getItem("liveloot-custom-streams");
      if (savedCustom) {
        const parsed = JSON.parse(savedCustom) as Stream[];
        if (Array.isArray(parsed)) {
          setCustomStreams(parsed);
        }
      }
    } catch {
      // Se o armazenamento local estiver indisponível, a lista continua funcionando em memória.
    } finally {
      setRemovedReady(true);
    }
    fetch("/api/dashboard")
      .then(async (response) => {
        if (response.status === 401) {
          window.location.replace("/login");
          return null;
        }
        const result = await readApiJson(response);
        if (!response.ok) throw new Error(apiError(result, `Falha ao carregar dashboard (HTTP ${response.status}).`));
        if (!result || typeof result !== "object" || !("user" in result) || !("streams" in result) || !Array.isArray(result.streams)) {
          throw new Error("A API respondeu, mas os dados do dashboard estão incompletos.");
        }
        return result;
      })
      .then((result) => { if (result) setData(result as DashboardData); })
      .catch((error: unknown) => setNotice(error instanceof Error ? error.message : "Não foi possível carregar as lives."))
      .finally(() => setDashboardLoading(false));
  }, []);

  const removeStream = useCallback((stream: Stream) => {
    setRemovedIds((current) => {
      const next = current.includes(stream.id) ? current : [...current, stream.id];
      try {
        window.localStorage.setItem("liveloot-removed-streams", JSON.stringify(next));
      } catch {
        // A remoção ainda vale até a página ser recarregada.
      }
      return next;
    });
    setLastRemoved(stream);
  }, []);

  const undoRemove = useCallback(() => {
    if (!lastRemoved) return;
    setRemovedIds((current) => {
      const next = current.filter((id) => id !== lastRemoved.id);
      try {
        window.localStorage.setItem("liveloot-removed-streams", JSON.stringify(next));
      } catch {
        // A restauração ainda vale até a página ser recarregada.
      }
      return next;
    });
    setLastRemoved(null);
  }, [lastRemoved]);

  const addStream = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAddError("");
    let url: URL;
    try {
      url = new URL(liveUrl.trim());
    } catch {
      setAddError("Cole um link válido da Twitch ou do Kick.");
      return;
    }

    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const platform = host === "twitch.tv" ? "twitch" : host === "kick.com" ? "kick" : null;
    const pathSegments = url.pathname.split("/").filter(Boolean);
    const channelName = pathSegments[0]?.toLowerCase();
    if (!platform || !["http:", "https:"].includes(url.protocol) || pathSegments.length !== 1 || !channelName || !/^[a-z0-9_]+$/.test(channelName)) {
      setAddError("Use o link direto de um canal da Twitch ou do Kick.");
      return;
    }

    const id = `${platform}-${channelName}`;
    const existingStream = [...(data?.streams ?? []), ...customStreams].find((stream) => stream.id.toLowerCase() === id);
    if (existingStream && !removedIds.includes(id)) {
      setAddError("Esse canal já está na sua lista.");
      return;
    }
    if (existingStream) {
      const restored = removedIds.filter((removedId) => removedId !== id);
      setRemovedIds(restored);
      try { window.localStorage.setItem("liveloot-removed-streams", JSON.stringify(restored)); } catch { /* Restaura até recarregar. */ }
      setLiveUrl("");
      setAddOpen(false);
      return;
    }

    const stream: Stream = {
      id,
      channelName,
      platform,
      category: "PokéIdle",
      title: `Canal ${channelName}`,
    };
    const next = [...customStreams, stream];
    setCustomStreams(next);
    try {
      window.localStorage.setItem("liveloot-custom-streams", JSON.stringify(next));
      const restored = removedIds.filter((removedId) => removedId !== id);
      setRemovedIds(restored);
      window.localStorage.setItem("liveloot-removed-streams", JSON.stringify(restored));
    } catch {
      // A live continua na lista até a página ser recarregada.
    }
    setLiveUrl("");
    setAddOpen(false);
  }, [customStreams, data?.streams, liveUrl, removedIds]);

  const handleLogout = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.replace("/login");
  }, []);

  const claimAdmin = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAdminSetupBusy(true);
    setAdminSetupError("");
    try {
      const response = await fetch("/api/auth/claim-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: adminSetupToken.trim() }),
      });
      const result = await readApiJson(response);
      if (!response.ok) {
        setAdminSetupError(apiError(result, `Não foi possível ativar o administrador (HTTP ${response.status}).`));
        return;
      }
      setData((current) => current ? { ...current, user: { ...current.user, role: "admin" } } : current);
      setAdminSetupOpen(false);
      setAdminSetupToken("");
    } catch {
      setAdminSetupError("Falha de conexão. Tente novamente.");
    } finally {
      setAdminSetupBusy(false);
    }
  }, [adminSetupToken]);

  const categories = useMemo(() => ["Todas", ...new Set((data?.streams ?? []).map((stream) => stream.category))], [data]);
  const streams = (removedReady ? [...(data?.streams ?? []), ...customStreams] : []).filter((stream) =>
    !removedIds.includes(stream.id) &&
    (activeFilter === "Todas" || stream.category === activeFilter) &&
    `${stream.channelName} ${stream.category} ${stream.title}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="LiveLoot início"><span className="brand-mark">L</span><span>live<span className="brand-accent">loot</span></span></a>
        <nav className="main-nav" aria-label="Navegação principal"><a className="nav-active" href="#lives">Explorar</a><a href="#lives">Minhas lives</a><a href="#rewards">Recompensas</a></nav>
        <div className="profile"><div className="avatar">{data?.user.name?.[0]?.toUpperCase() ?? "L"}</div><span>{data?.user.name ?? (dashboardLoading ? "Carregando" : "Dashboard indisponível")}</span>{data?.user.role === "admin" ? <span className="admin-badge">ADMIN</span> : <button className="claim-admin-button" onClick={() => { setAdminSetupError(""); setAdminSetupOpen(true); }}>Configurar admin</button>}<button className="logout-button" onClick={handleLogout}>Sair</button></div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span className="sparkle">✦</span> ASSISTA. CONFIRA. RESGATE.</div>
          <h1>Pontos oficiais<br /><span>na sua conta.</span></h1>
          <p>Use o player como prévia. Para garantir sua sessão e conferir pontos, assista logado no canal oficial.</p>
          <div className="hero-tags"><span>Entre na Twitch e na Kick</span><span>Abra cada live em sua plataforma</span></div>
        </div>
        <div className="official-points-note">
          <strong>LiveLoot não concede pontos por assistir.</strong>
          <span>Os pontos são da Twitch ou da Kick. Para bônus do jogo, vincule as contas na sua conta do PokeIdle.</span>
          <a href="https://pokeidle.io" target="_blank" rel="noopener noreferrer">Abrir PokeIdle ↗</a>
        </div>
        <div className="hero-orb orb-one" /><div className="hero-orb orb-two" />
      </section>

      <section className="content" id="lives">
        <div className="section-heading"><div><div className="eyebrow section-eyebrow">CANAIS</div><h2>Escolha uma live</h2><p>O status informa o que o player permite verificar; confirme seus pontos no canal oficial.</p></div><button className="view-all">Ver todas <span>→</span></button></div>
        <div className="toolbar"><div className="filters" role="tablist" aria-label="Filtrar lives por categoria">{categories.map((category) => <button key={category} className={`filter ${activeFilter === category ? "filter-active" : ""}`} onClick={() => setActiveFilter(category)}>{category}</button>)}</div><div className="toolbar-actions"><label className="search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar live..." aria-label="Buscar live" /><kbd>⌘ K</kbd></label>{data && <button className="add-live-button" onClick={() => { setAddError(""); setAddOpen(true); }}><span className="add-icon" aria-hidden="true">+</span><span>Adicionar live</span></button>}</div></div>
        {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Fechar aviso">×</button></div>}
        {lastRemoved && <div className="notice remove-notice" role="status">Live de {lastRemoved.channelName} removida da sua lista.<button className="undo-remove" onClick={undoRemove}>Desfazer</button><button onClick={() => setLastRemoved(null)} aria-label="Fechar aviso">×</button></div>}
        {addOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setAddOpen(false); }}><section className="add-modal" role="dialog" aria-modal="true" aria-labelledby="add-live-title"><button className="modal-close" onClick={() => setAddOpen(false)} aria-label="Fechar">×</button><div className="eyebrow">SUA LISTA DE LIVES</div><h3 id="add-live-title">Adicionar live</h3><p>Cole o link do canal da Twitch ou do Kick.</p><form onSubmit={addStream}><label htmlFor="live-url">Link da live</label><input id="live-url" type="url" value={liveUrl} onChange={(event) => setLiveUrl(event.target.value)} placeholder="https://www.twitch.tv/canal" autoFocus required />{addError && <div className="form-error" role="alert">{addError}</div>}<div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setAddOpen(false)}>Cancelar</button><button type="submit" className="add-live-button">Adicionar</button></div></form></section></div>}
        {adminSetupOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setAdminSetupOpen(false); }}><section className="add-modal" role="dialog" aria-modal="true" aria-labelledby="claim-admin-title"><button className="modal-close" onClick={() => setAdminSetupOpen(false)} aria-label="Fechar">×</button><div className="eyebrow">CONFIGURAÇÃO DO SITE</div><h3 id="claim-admin-title">Ativar administrador</h3><p>O dono do site encontra este código nas variáveis de ambiente da hospedagem.</p><form onSubmit={claimAdmin}><label htmlFor="admin-setup-token">Código de configuração</label><input id="admin-setup-token" type="password" autoComplete="off" value={adminSetupToken} onChange={(event) => setAdminSetupToken(event.target.value)} required autoFocus />{adminSetupError && <div className="form-error" role="alert">{adminSetupError}</div>}<div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setAdminSetupOpen(false)}>Cancelar</button><button type="submit" className="add-live-button" disabled={adminSetupBusy}>{adminSetupBusy ? "Verificando…" : "Ativar admin"}</button></div></form></section></div>}
        <div className="stream-grid">
          {streams.map((stream) => <article className="stream-card" key={stream.id}>
            <PlayerEmbed stream={stream} />
            <div className="card-info">
              <div className={`platform-icon platform-${stream.platform}`}>{stream.platform === "twitch" ? "▣" : "K"}</div>
              <div className="stream-copy"><div className="stream-title">{stream.title}</div><div className="stream-meta">{stream.channelName} <span>·</span> {stream.category}</div></div>
              {data?.user.role === "admin" && <button className="remove-live" onClick={() => removeStream(stream)} aria-label={`Remover live de ${stream.channelName}`} title="Remover live"><span aria-hidden="true">×</span><span className="remove-label">Remover</span></button>}
            </div>
            <div className="card-footer"><span>Pontos verificados no canal</span><a className="platform-open-link" href={`https://${stream.platform === "twitch" ? "www.twitch.tv" : "kick.com"}/${encodeURIComponent(stream.channelName)}`} target="_blank" rel="noopener noreferrer">Assistir na {stream.platform === "twitch" ? "Twitch" : "Kick"} ↗</a></div>
          </article>)}
          {streams.length === 0 && <div className="empty-state">Nenhuma live encontrada. Tente outra busca ou categoria.</div>}
        </div>
      </section>

      <footer id="rewards"><span>✦</span> LiveLoot <span className="footer-muted">· Não rastreamos nem concedemos os pontos oficiais das plataformas. Verifique o saldo no canal depois de entrar.</span><span className="footer-right">PokeIdle exige vincular suas contas para conceder bônus de live.</span></footer>
    </main>
  );
}
