"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/frontend/lib/supabase/client";

export default function ResetPasswordPage() {
  const supabase = useMemo(() => createClient(), []);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirmation) {
      setError("As senhas não coincidem.");
      return;
    }

    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) setError("Não foi possível atualizar a senha. Solicite um novo link e tente novamente.");
    else window.location.replace("/");
    setBusy(false);
  }

  return (
    <main className="auth-shell">
      <Link className="brand auth-brand" href="/" aria-label="LiveLoot"><span className="brand-mark">L</span><span>live<span className="brand-accent">loot</span></span></Link>
      <section className="auth-panel">
        <div className="eyebrow">RECUPERAÇÃO DE CONTA</div>
        <h1>Escolha uma nova senha</h1>
        <p className="auth-intro">Crie uma senha com pelo menos 10 caracteres.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>Nova senha<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={10} maxLength={128} /></label>
          <label>Confirme a nova senha<input type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required minLength={10} maxLength={128} /></label>
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar nova senha"}</button>
        </form>
        <div className="auth-switch"><Link href="/login">Voltar para o login</Link></div>
      </section>
      <div className="auth-footer">Sua senha é gerenciada pelo Supabase Auth.</div>
    </main>
  );
}
