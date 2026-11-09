"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/frontend/lib/supabase/client";

function getNextPath() {
  const next = new URLSearchParams(window.location.search).get("next");
  return next?.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/";
}

export default function LoginPage() {
  const supabase = useMemo(() => createClient(), []);
  const [isSignup, setIsSignup] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [isPending, setIsPending] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setIsPending(false);
      if (data.session && !isSignup && !busy) window.location.replace(getNextPath());
    }).catch(() => {
      if (!active) return;
      setIsPending(false);
      setError("Não foi possível verificar sua sessão. Confira a conexão e tente novamente.");
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && !isSignup && !busy) window.location.replace(getNextPath());
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase, isSignup, busy]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      if (isSignup) {
        const { data, error: signupError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { name: name.trim() },
            emailRedirectTo: `${window.location.origin}/auth/confirm?next=/`,
          },
        });
        if (signupError) {
          setError("Não foi possível criar a conta. Confira o e-mail e tente outra senha.");
        } else if (data.session) {
          window.location.replace(getNextPath());
        } else {
          setMessage("Enviamos um link de confirmação para seu e-mail. Confirme a conta para continuar.");
        }
      } else {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (loginError?.code === "email_not_confirmed") {
          setError("Confirme seu e-mail pelo link que enviamos antes de entrar.");
        } else if (loginError && !["invalid_credentials", "user_not_found"].includes(loginError.code ?? "")) {
          setError("Não foi possível conectar ao serviço de login. Tente novamente em instantes.");
        } else if (loginError) {
          const migrationResponse = await fetch("/api/auth/migrate-legacy", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: email.trim(), password }),
          });
          const migration = await migrationResponse.json().catch(() => ({})) as { status?: string; error?: string };

          if (migration.status === "migrated") {
            const { error: migratedLoginError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
            if (migratedLoginError) {
              setError("Sua conta antiga foi migrada, mas n\u00e3o foi poss\u00edvel iniciar a sess\u00e3o. Tente entrar novamente.");
            } else {
              await fetch("/api/auth/complete-migration", { method: "POST" }).catch(() => undefined);
              window.location.replace(getNextPath());
            }
          } else if (migration.status === "confirmation_required") {
            setMessage("Sua conta antiga foi migrada. Enviamos um link de confirma\u00e7\u00e3o para seu e-mail; confirme-o antes de entrar.");
          } else if (migration.status === "conflict") {
            setError(migration.error ?? "J\u00e1 existe uma conta Supabase com este e-mail. Use \u201cEsqueci minha senha\u201d para recuperar o acesso; a senha existente n\u00e3o foi alterada.");
          } else if (migration.status === "unavailable") {
            setError(migration.error ?? "A migra\u00e7\u00e3o est\u00e1 temporariamente indispon\u00edvel. Aguarde alguns minutos e tente novamente.");
          } else {
            setError("N\u00e3o foi poss\u00edvel entrar. Confira o e-mail e a senha. Se sua conta j\u00e1 foi criada no Supabase, use \u201cEsqueci minha senha\u201d para recuperar o acesso.");
          }
        } else {
          await fetch("/api/auth/complete-migration", { method: "POST" }).catch(() => undefined);
          window.location.replace(getNextPath());
        }
      }
    } catch {
      setError("Não consegui conectar ao LiveLoot. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <Link className="brand auth-brand" href="/" aria-label="LiveLoot"><span className="brand-mark">L</span><span>live<span className="brand-accent">loot</span></span></Link>
      <section className="auth-panel">
        <div className="eyebrow">SUA CONTA LIVELOOT</div>
        <h1>{isSignup ? "Crie sua conta" : "Que bom ter você de volta"}</h1>
        <p className="auth-intro">Entre com seu e-mail para acessar suas lives e seu saldo.</p>
        {isSignup && <div className="admin-first-note">Depois de criar sua conta, confirme seu e-mail. O acesso de administrador pode ser configurado após entrar.</div>}
        <form className="auth-form" onSubmit={handleSubmit}>
          {isSignup && <label>Nome<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Como podemos chamar você?" required maxLength={80} /></label>}
          <label>E-mail<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@exemplo.com" required maxLength={254} /></label>
          <label>Senha<input type="password" autoComplete={isSignup ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isSignup ? "Pelo menos 10 caracteres" : "Sua senha"} required minLength={isSignup ? 10 : 1} maxLength={128} /></label>
          {error && <div className="auth-error" role="alert">{error}</div>}
          {message && <div className="admin-first-note" role="status">{message}</div>}
          <button className="auth-submit" type="submit" disabled={busy || isPending}>{busy ? "Aguarde…" : isSignup ? "Criar conta" : "Entrar"}</button>
        </form>
        {!isSignup && <div className="auth-switch"><Link href="/forgot-password">Esqueci minha senha</Link></div>}
        <div className="auth-switch">{isSignup ? "Já tem uma conta?" : "Ainda não tem uma conta?"}<button type="button" onClick={() => { setIsSignup((current) => !current); setError(""); setMessage(""); }}> {isSignup ? "Fazer login" : "Criar conta"}</button></div>
        <div className="auth-security">Sua senha é armazenada e verificada pelo Supabase Auth. Use o botão do canal para entrar diretamente na Twitch ou no Kick; o LiveLoot não recebe a senha dessas plataformas.</div>
      </section>
      <div className="auth-footer">Assista nas plataformas oficiais para receber os pontos de cada canal.</div>
    </main>
  );
}
