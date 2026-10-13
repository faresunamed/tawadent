"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { useT } from "@/lib/useLocale";
import { normalizeTnPhone } from "@/lib/phone";
import { ErrorNotice, InfoNotice } from "./Notice";

/** Inscription et connexion du patient : email + mot de passe. */
export default function PatientAuth({ redirectPath }: { redirectPath: string }) {
  const { t } = useT();
  const [register, setRegister] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [created, setCreated] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreated(false);
    const sb = getSupabase();
    if (!register) {
      setBusy(true);
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      setBusy(false);
      if (error) setError(error);
      return;
    }
    const tn = normalizeTnPhone(phone);
    if (!tn) return setError(new Error("invalid_input"));
    setBusy(true);
    const { data, error } = await sb.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { role: "patient", first_name: firstName.trim(), phone: tn },
        emailRedirectTo: `${window.location.origin}${redirectPath}`,
      },
    });
    setBusy(false);
    if (error) setError(error);
    else if (!data.session) setCreated(true);
  }

  return (
    <section className="card narrow">
      <h2>{register ? t.patient.registerTitle : t.patient.loginExistingTitle}</h2>
      <p className="muted">{register ? t.patient.registerText : t.patient.loginText}</p>
      <form onSubmit={submit} className="stack">
        {register && (
          <>
            <label className="field">
              <span className="label">{t.patient.firstName}</span>
              <input className="input" required maxLength={60} autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </label>
            <label className="field">
              <span className="label">{t.common.phone}</span>
              <input className="input" type="tel" inputMode="tel" autoComplete="tel" required placeholder="20 000 000" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
              <span className="help">{t.patient.phoneHelp}</span>
            </label>
          </>
        )}
        <label className="field">
          <span className="label">{t.common.email}</span>
          <input className="input" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
        </label>
        <label className="field">
          <span className="label">{t.common.password}</span>
          <input
            className="input"
            type="password"
            autoComplete={register ? "new-password" : "current-password"}
            required
            minLength={register ? 10 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            dir="ltr"
          />
          {register && <span className="help">{t.dentist.passwordHelp}</span>}
        </label>
        {register && (
          <label className="check">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
            <span>{t.patient.consent}</span>
          </label>
        )}
        <button className="btn btn-primary" disabled={busy || (register && (!consent || !firstName.trim()))}>
          {register ? t.dentist.signUp : t.dentist.signIn}
        </button>
      </form>
      {created && <InfoNotice tone="ok">{t.dentist.confirmEmail}</InfoNotice>}
      <ErrorNotice error={error} />
      <button
        type="button"
        className="link-btn"
        onClick={() => {
          setRegister(!register);
          setError(null);
          setCreated(false);
        }}
      >
        {register ? t.patient.switchToLogin : t.patient.switchToRegister}
      </button>
    </section>
  );
}
