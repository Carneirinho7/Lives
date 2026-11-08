"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { Stream, User } from "@/shared/types";
import { PlayerEmbed } from "@/frontend/components/player-embed";
import { authClient } from "@/frontend/auth/auth-client";

type DashboardData = { user: User; streams: Stream[] };

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [activeFilter, setActiveFilter] = useState("Todas");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [activeStreams, setActiveStreams] = useState<string[]>([]);
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
      if (saved) setRemovedIds(JSON.parse(saved) as string[]);
      const savedCustom = window.localStorage.getItem("liveloot-custom-streams");
      if (savedCustom) {
        const parsed = JSON.parse(savedCustom) as Stream[];
        if (Array.isArray(parsed)) setCustomStreams(parsed);
      }
    } catch {
      // Se o armazenamento local estiver indisponível, a lista continua funcionando em memória.
    } finally {
      setRemovedReady(true);
    }
    fetch("/api/dashboard")
      .then((response) => {
        if (response.status === 401) {
          window.location.replace("/login");
          return null;
        }
        if (!response.ok) throw new Error("Dashboard indisponível");
        return response.json();
      })
      .then((result) => { if (result) setData(result); })
      .catch(() => setNotice("Não foi possível carregar as lives."));
  }, []);

  const handleActivity = useCallback((streamId: string, active: boolean) => {
    setActiveStreams((current) => active
      ? current.includes(streamId) ? current : [...current, streamId]
      : current.filter((id) => id !== streamId));
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
      viewers: "canal adicionado",
      title: `PokéIdle — live de ${channelName}`,
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

  const handlePing = useCallback(async (streamId: string) => {
    try {
      const response = await fetch("/api/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streamId }),
      });
      const result = await response.json();
      if (response.ok) {
        setData((current) => current ? { ...current, user: { ...current.user, pointsBalance: result.pointsBalance } } : current);
      } else if (response.status !== 429) {
        setNotice(result.error ?? "Não foi possível registrar os pontos.");
      }
    } catch {
      setNotice("Falha de conexão ao registrar os pontos.");
    }
  }, []);

  const handleLogout = useCallback(async () => {
    await authClient.signOut();
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
      const result = await response.json();
      if (!response.ok) {
        setAdminSetupError(result.error ?? "Não foi possível ativar o administrador.");
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
        <div className="profile"><div className="avatar">{data?.user.name?.[0]?.toUpperCase() ?? "L"}</div><span>{data?.user.name ?? "Carregando"}</span>{data?.user.role === "admin" ? <span className="admin-badge">ADMIN</span> : <button className="claim-admin-button" onClick={() => { setAdminSetupError(""); setAdminSetupOpen(true); }}>Configurar admin</button>}<button className="logout-button" onClick={handleLogout}>Sair</button></div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span className="sparkle">✦</span> ASSISTA. ACUMULE. RESGATE.</div>
          <h1>Seu tempo de live<br /><span>vale mais.</span></h1>
          <p>Acompanhe suas lives favoritas e abra o canal oficial para receber recompensas da plataforma.</p>
          <div className="hero-tags"><span>✦ Acesso ao canal oficial</span><span>◷ Recompensas na sua conta</span></div>
        </div>
        <div className="balance-card">
          <div className="balance-top"><span>PONTOS LIVELOOT · DEMONSTRAÇÃO</span><span className="balance-icon">✧</span></div>
          <div className="balance-number">{(data?.user.pointsBalance ?? 0).toLocaleString("pt-BR")} <span>pts</span></div>
          <div className="balance-footer"><span className={`live-indicator ${activeStreams.length ? "" : "indicator-paused"}`} /> {data ? activeStreams.length ? "Contagem interna ativa" : "Contagem interna pausada" : "Conectando"}<span className="points-rate">+5 pts internos / live / min</span></div>
          <div className="balance-progress"><span /></div>
          <div className="balance-footnote">Continue assistindo para subir de nível <span>→</span></div>
        </div>
        <div className="hero-orb orb-one" /><div className="hero-orb orb-two" />
      </section>

      <section className="content" id="lives">
        <div className="section-heading"><div><div className="eyebrow section-eyebrow">AO VIVO AGORA <span className="live-indicator" /></div><h2>Encontre sua próxima live</h2><p>Escolha uma live e seus pontos começam a contar automaticamente.</p></div><button className="view-all">Ver todas <span>→</span></button></div>
        <div className="toolbar"><div className="filters" role="tablist" aria-label="Filtrar lives por categoria">{categories.map((category) => <button key={category} className={`filter ${activeFilter === category ? "filter-active" : ""}`} onClick={() => setActiveFilter(category)}>{category}</button>)}</div><div className="toolbar-actions"><label className="search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar live..." aria-label="Buscar live" /><kbd>⌘ K</kbd></label>{data?.user.role === "admin" && <button className="add-live-button" onClick={() => { setAddError(""); setAddOpen(true); }}><span className="add-icon" aria-hidden="true">+</span><span>Adicionar live</span></button>}</div></div>
        {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Fechar aviso">×</button></div>}
        {lastRemoved && <div className="notice remove-notice" role="status">Live de {lastRemoved.channelName} removida da sua lista.<button className="undo-remove" onClick={undoRemove}>Desfazer</button><button onClick={() => setLastRemoved(null)} aria-label="Fechar aviso">×</button></div>}
        {addOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setAddOpen(false); }}><section className="add-modal" role="dialog" aria-modal="true" aria-labelledby="add-live-title"><button className="modal-close" onClick={() => setAddOpen(false)} aria-label="Fechar">×</button><div className="eyebrow">SUA LISTA DE LIVES</div><h3 id="add-live-title">Adicionar live</h3><p>Cole o link do canal da Twitch ou do Kick.</p><form onSubmit={addStream}><label htmlFor="live-url">Link da live</label><input id="live-url" type="url" value={liveUrl} onChange={(event) => setLiveUrl(event.target.value)} placeholder="https://www.twitch.tv/canal" autoFocus required />{addError && <div className="form-error" role="alert">{addError}</div>}<div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setAddOpen(false)}>Cancelar</button><button type="submit" className="add-live-button">Adicionar</button></div></form></section></div>}
        {adminSetupOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setAdminSetupOpen(false); }}><section className="add-modal" role="dialog" aria-modal="true" aria-labelledby="claim-admin-title"><button className="modal-close" onClick={() => setAdminSetupOpen(false)} aria-label="Fechar">×</button><div className="eyebrow">CONFIGURAÇÃO DO SITE</div><h3 id="claim-admin-title">Ativar administrador</h3><p>O dono do site encontra este código nas variáveis de ambiente da hospedagem.</p><form onSubmit={claimAdmin}><label htmlFor="admin-setup-token">Código de configuração</label><input id="admin-setup-token" type="password" autoComplete="off" value={adminSetupToken} onChange={(event) => setAdminSetupToken(event.target.value)} required autoFocus />{adminSetupError && <div className="form-error" role="alert">{adminSetupError}</div>}<div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setAdminSetupOpen(false)}>Cancelar</button><button type="submit" className="add-live-button" disabled={adminSetupBusy}>{adminSetupBusy ? "Verificando…" : "Ativar admin"}</button></div></form></section></div>}
        <div className="stream-grid">
          {streams.map((stream) => <article className="stream-card" key={stream.id}>
            <PlayerEmbed stream={stream} onPing={handlePing} onActivity={handleActivity} />
            <div className="card-info">
              <div className={`platform-icon platform-${stream.platform}`}>{stream.platform === "twitch" ? "▣" : "K"}</div>
              <div className="stream-copy"><div className="stream-title">{stream.title}</div><div className="stream-meta">{stream.channelName} <span>·</span> {stream.category}</div></div>
              {data?.user.role === "admin" && <button className="remove-live" onClick={() => removeStream(stream)} aria-label={`Remover live de ${stream.channelName}`} title="Remover live"><span aria-hidden="true">×</span><span className="remove-label">Remover</span></button>}
            </div>
            <div className="card-footer"><span className="viewers"><span className="viewer-dot" />{stream.viewers} assistindo</span><a className="platform-open-link" href={`https://${stream.platform === "twitch" ? "www.twitch.tv" : "kick.com"}/${encodeURIComponent(stream.channelName)}`} target="_blank" rel="noopener noreferrer">Abrir {stream.platform === "twitch" ? "Twitch" : "Kick"} ↗</a></div>
          </article>)}
          {streams.length === 0 && <div className="empty-state">Nenhuma live encontrada. Tente outra busca ou categoria.</div>}
        </div>
      </section>

      <footer id="rewards"><span>✦</span> LiveLoot <span className="footer-muted">· Pontos LiveLoot são demonstrativos; pontos oficiais ficam na sua conta da plataforma.</span><span className="footer-right">Abra o canal oficial para acompanhar os pontos da plataforma</span></footer>
    </main>
  );
}
