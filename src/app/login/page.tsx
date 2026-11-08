"use client";

import { useEffect, useState, type FormEvent } from "react";
import { authClient } from "@/frontend/auth/auth-client";

export default function LoginPage() {
  const [isSignup, setIsSignup] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (session) window.location.replace("/");
  }, [session]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = isSignup
        ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
        : await authClient.signIn.email({ email: email.trim(), password });

      if (result.error) {
        setError(isSignup ? "Não foi possível criar a conta. Confira o e-mail e tente outra senha." : "E-mail ou senha incorretos.");
        return;
      }
      window.location.replace("/");
    } catch {
      setError("Não consegui conectar ao LiveLoot. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <a className="brand auth-brand" href="/" aria-label="LiveLoot"><span className="brand-mark">L</span><span>live<span className="brand-accent">loot</span></span></a>
      <section className="auth-panel">
        <div className="eyebrow">SUA CONTA LIVELOOT</div>
        <h1>{isSignup ? "Crie sua conta" : "Que bom ter você de volta"}</h1>
        <p className="auth-intro">Entre com seu e-mail para acessar suas lives e seu saldo.</p>
        {isSignup && <div className="admin-first-note">A primeira conta criada neste app recebe acesso de administrador.</div>}
        <form className="auth-form" onSubmit={handleSubmit}>
          {isSignup && <label>Nome<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Como podemos chamar você?" required maxLength={80} /></label>}
          <label>E-mail<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@exemplo.com" required maxLength={254} /></label>
          <label>Senha<input type="password" autoComplete={isSignup ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isSignup ? "Pelo menos 10 caracteres" : "Sua senha"} required minLength={isSignup ? 10 : 1} maxLength={128} /></label>
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="auth-submit" type="submit" disabled={busy || isPending}>{busy ? "Aguarde…" : isSignup ? "Criar conta e entrar" : "Entrar"}</button>
        </form>
        <div className="auth-switch">{isSignup ? "Já tem uma conta?" : "Ainda não tem uma conta?"}<button type="button" onClick={() => { setIsSignup((current) => !current); setError(""); }}> {isSignup ? "Fazer login" : "Criar conta"}</button></div>
        <div className="auth-security">Sua senha é armazenada com hash seguro. Use o botão do canal para entrar diretamente na Twitch ou no Kick; o LiveLoot não recebe a senha dessas plataformas.</div>
      </section>
      <div className="auth-footer">Assista nas plataformas oficiais para receber os pontos de cada canal.</div>
    </main>
  );
}
