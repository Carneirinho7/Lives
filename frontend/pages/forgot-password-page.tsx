"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/frontend/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
      });
      if (resetError) setError("Não foi possível enviar o link. Confira o e-mail e tente novamente.");
      else setMessage("Se houver uma conta para esse e-mail, enviaremos um link para redefinir a senha.");
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
        <div className="eyebrow">RECUPERAÇÃO DE CONTA</div>
        <h1>Redefina sua senha</h1>
        <p className="auth-intro">Informe o e-mail da sua conta para receber um link seguro.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>E-mail<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@exemplo.com" required maxLength={254} /></label>
          {error && <div className="auth-error" role="alert">{error}</div>}
          {message && <div className="admin-first-note" role="status">{message}</div>}
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Enviando…" : "Enviar link"}</button>
        </form>
        <div className="auth-switch"><Link href="/login">Voltar para o login</Link></div>
      </section>
      <div className="auth-footer">A recuperação é feita por um link enviado pelo Supabase Auth.</div>
    </main>
  );
}
