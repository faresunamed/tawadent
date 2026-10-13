"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { useT } from "@/lib/useLocale";
import { ErrorNotice, InfoNotice } from "./Notice";

type Props = {
  title: string;
  /** Autorise la création de compte (dentistes). Désactivé pour l'admin. */
  allowSignup: boolean;
  redirectPath: string;
};

export default function PasswordAuth({ title, allowSignup, redirectPath }: Props) {
  const { t } = useT();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [created, setCreated] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setCreated(false);
    const sb = getSupabase();
    if (mode === "signin") {
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setError(error);
    } else {
      const { data, error } = await sb.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { role: "dentist" },
          emailRedirectTo: `${window.location.origin}${redirectPath}`,
        },
      });
      if (error) setError(error);
      else if (!data.session) setCreated(true);
    }
    setBusy(false);
  }

  return (
    <section className="card narrow">
      <h2>{mode === "signin" ? title : t.dentist.signupTitle}</h2>
      <form onSubmit={submit} className="stack">
        <label className="field">
          <span className="label">{t.common.email}</span>
          <input
            className="input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            dir="ltr"
          />
        </label>
        <label className="field">
          <span className="label">{t.common.password}</span>
          <input
            className="input"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            dir="ltr"
          />
          {mode === "signup" && <span className="help">{t.dentist.passwordHelp}</span>}
        </label>
        <button className="btn btn-primary" disabled={busy}>
          {mode === "signin" ? t.dentist.signIn : t.dentist.signUp}
        </button>
      </form>
      {created && <InfoNotice tone="ok">{t.dentist.confirmEmail}</InfoNotice>}
      <ErrorNotice error={error} />
      {allowSignup && (
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
            setCreated(false);
          }}
        >
          {mode === "signin" ? t.dentist.switchToSignup : t.dentist.switchToLogin}
        </button>
      )}
    </section>
  );
}
