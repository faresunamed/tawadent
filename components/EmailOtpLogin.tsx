"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { useT } from "@/lib/useLocale";
import { fmt } from "@/lib/i18n";
import { ErrorNotice, InfoNotice } from "./Notice";

/** Connexion patient par email : code à saisir (ou clic sur le lien reçu). */
export default function EmailOtpLogin({ redirectPath }: { redirectPath: string }) {
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await getSupabase().auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        data: { role: "patient" },
        emailRedirectTo: `${window.location.origin}${redirectPath}`,
      },
    });
    setBusy(false);
    if (error) setError(error);
    else setSent(true);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await getSupabase().auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    if (error) setError(error);
  }

  return (
    <section className="card">
      <h2>{t.patient.loginTitle}</h2>
      <p className="muted">{t.patient.loginText}</p>
      {!sent ? (
        <form onSubmit={sendCode} className="stack">
          <label className="field">
            <span className="label">{t.common.email}</span>
            <input
              className="input"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              dir="ltr"
            />
          </label>
          <button className="btn btn-primary" disabled={busy}>
            {t.patient.sendCode}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="stack">
          <InfoNotice tone="ok">{fmt(t.patient.codeSent, { email })}</InfoNotice>
          <label className="field">
            <span className="label">{t.patient.codeLabel}</span>
            <input
              className="input code-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              dir="ltr"
            />
          </label>
          <button className="btn btn-primary" disabled={busy || code.trim().length < 4}>
            {t.patient.verify}
          </button>
        </form>
      )}
      <ErrorNotice error={error} />
    </section>
  );
}
