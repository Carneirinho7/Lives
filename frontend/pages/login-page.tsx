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
        } else if (loginError) {
          setError("Não foi possível entrar. As senhas da versão antiga do LiveLoot não foram migradas para o Supabase. Se ainda não criou sua conta aqui, clique em “Criar conta” e escolha uma nova senha. Se já criou e confirmou, use “Esqueci minha senha”.");
        }
        else window.location.replace(getNextPath());
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
