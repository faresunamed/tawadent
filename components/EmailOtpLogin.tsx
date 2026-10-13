"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { useT } from "@/lib/useLocale";
import { fmt } from "@/lib/i18n";
import { normalizeTnPhone } from "@/lib/phone";
import { ErrorNotice, InfoNotice } from "./Notice";

/** Connexion patient par email : code à saisir (ou clic sur le lien reçu). */
export default function EmailOtpLogin({ redirectPath }: { redirectPath: string }) {
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [register, setRegister] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    const tn = phone.trim() ? normalizeTnPhone(phone) : null;
    if (register && !tn) {
      setError(new Error("invalid_input"));
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await getSupabase().auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        data: register ? { role: "patient", first_name: firstName.trim(), phone: tn } : { role: "patient" },
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
      <h2>{register ? t.patient.registerTitle : t.patient.loginExistingTitle}</h2>
      <p className="muted">{register ? t.patient.registerText : t.patient.loginText}</p>
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
          {register && (
            <>
              <label className="field">
                <span className="label">{t.patient.firstName}</span>
                <input
                  className="input"
                  required
                  maxLength={60}
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </label>
              <label className="field">
                <span className="label">{t.common.phone}</span>
                <input
                  className="input"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  placeholder="20 000 000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  dir="ltr"
                />
                <span className="help">{t.patient.phoneHelp}</span>
              </label>
              <label className="check">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
                <span>{t.patient.consent}</span>
              </label>
            </>
          )}
          <button className="btn btn-primary" disabled={busy || (register && (!consent || !firstName.trim()))}>
            {t.patient.sendCode}
          </button>
          <button type="button" className="link-btn" onClick={() => setRegister(!register)}>
            {register ? t.patient.switchToLogin : t.patient.switchToRegister}
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
