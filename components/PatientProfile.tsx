"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { useT } from "@/lib/useLocale";
import { normalizeTnPhone } from "@/lib/phone";
import { ErrorNotice } from "./Notice";

/** Prénom + téléphone du patient (comptes créés sans ces informations). */
export default function PatientProfile({
  initialName,
  initialPhone,
  onSaved,
}: {
  initialName: string;
  initialPhone: string;
  onSaved: () => void;
}) {
  const { t } = useT();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const tn = normalizeTnPhone(phone);
    if (!tn) return setError(new Error("invalid_input"));
    setBusy(true);
    setError(null);
    const { error } = await getSupabase().auth.updateUser({ data: { first_name: name.trim(), phone: tn } });
    setBusy(false);
    if (error) setError(error);
    else onSaved();
  }

  return (
    <form className="card stack" onSubmit={save}>
      <h2>{t.patient.completeTitle}</h2>
      <p className="muted">{t.patient.completeText}</p>
      <label className="field">
        <span className="label">{t.patient.firstName}</span>
        <input className="input" required maxLength={60} autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        <span className="label">{t.common.phone}</span>
        <input className="input" type="tel" inputMode="tel" autoComplete="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
        <span className="help">{t.patient.phoneHelp}</span>
      </label>
      <label className="check">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
        <span>{t.patient.consent}</span>
      </label>
      <button className="btn btn-primary" disabled={busy || !consent || !name.trim()}>
        {t.patient.completeSave}
      </button>
      <ErrorNotice error={error} />
    </form>
  );
}
