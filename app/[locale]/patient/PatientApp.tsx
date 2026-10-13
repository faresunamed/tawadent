"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { useT } from "@/lib/useLocale";
import { useCountdown } from "@/lib/useCountdown";
import { fmt } from "@/lib/i18n";
import { ZONES } from "@/lib/zones";
import { directionsUrl, telUrl } from "@/lib/maps";
import { formatCountdown, minutesUntil } from "@/lib/time";
import type { Clinic, PatientRequest } from "@/lib/types";
import EmailOtpLogin from "@/components/EmailOtpLogin";
import { ConfigNotice, ErrorNotice, InfoNotice } from "@/components/Notice";

type Tracked = { data: PatientRequest; receivedAt: number };

export default function PatientApp() {
  const { t, locale } = useT();
  const auth = useAuth();
  const userId = auth.user?.id ?? null;

  const [zoneId, setZoneId] = useState("");
  const [clinics, setClinics] = useState<Clinic[] | null>(null);
  const [selected, setSelected] = useState<Clinic | null>(null);
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [request, setRequest] = useState<Tracked | null>(null);
  const requestRef = useRef<Tracked | null>(null);
  requestRef.current = request;

  const track = useCallback((data: PatientRequest) => {
    setRequest({ data, receivedAt: Date.now() });
  }, []);

  // --- Reprise d'une demande en cours après rechargement de la page ---
  useEffect(() => {
    if (!userId || auth.role !== "patient") return;
    getSupabase()
      .rpc("get_my_latest_request")
      .then(({ data, error }) => {
        if (!error && data) track(data as PatientRequest);
      });
  }, [userId, auth.role, track]);

  // --- Liste des cabinets de la zone (rafraîchie toutes les 10 s) ---
  const loadClinics = useCallback(async () => {
    if (!zoneId || !auth.configured) return;
    const { data, error } = await getSupabase().rpc("list_available_clinics", { p_zone: zoneId });
    if (error) setError(error);
    else setClinics((data as Clinic[]) ?? []);
  }, [zoneId, auth.configured]);

  useEffect(() => {
    setClinics(null);
    setSelected(null);
    if (!zoneId) return;
    loadClinics();
    if (request) return;
    const id = setInterval(loadClinics, 10000);
    return () => clearInterval(id);
  }, [zoneId, loadClinics, request]);

  // --- Suivi de la demande : interrogation toutes les 2 s + temps réel ---
  const refreshRequest = useCallback(async () => {
    const current = requestRef.current;
    if (!current) return;
    const { data, error } = await getSupabase().rpc("get_request", { p_request: current.data.id });
    if (!error && data) {
      const next = data as PatientRequest;
      if (next.status === "accepted" && current.data.status !== "accepted") {
        try {
          navigator.vibrate?.(200);
        } catch {}
      }
      track(next);
    }
  }, [track]);

  const pending = request?.data.status === "pending";
  const requestId = request?.data.id;

  useEffect(() => {
    if (!pending || !requestId) return;
    const id = setInterval(refreshRequest, 2000);
    const sb = getSupabase();
    const channel = userId
      ? sb
          .channel(`patient-request-${requestId}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "requests", filter: `patient_id=eq.${userId}` },
            () => refreshRequest()
          )
          .subscribe()
      : null;
    return () => {
      clearInterval(id);
      if (channel) sb.removeChannel(channel);
    };
  }, [pending, requestId, userId, refreshRequest]);

  // --- Actions ---
  async function sendRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError(null);
    const sb = getSupabase();
    const created = await sb.rpc("create_request", {
      p_dentist: selected.id,
      p_first_name: firstName,
      p_phone: phone.trim() || null,
    });
    if (created.error) {
      setBusy(false);
      setError(created.error);
      loadClinics();
      return;
    }
    const got = await sb.rpc("get_request", { p_request: created.data as string });
    setBusy(false);
    if (got.error) setError(got.error);
    else track(got.data as PatientRequest);
  }

  async function cancelRequest() {
    if (!request) return;
    setBusy(true);
    await getSupabase().rpc("cancel_request", { p_request: request.data.id });
    await refreshRequest();
    setBusy(false);
  }

  function backToList() {
    setRequest(null);
    setSelected(null);
    setError(null);
    loadClinics();
  }

  function newSearch() {
    setRequest(null);
    setSelected(null);
    setZoneId("");
    setError(null);
  }

  // --- Rendu ---
  if (!auth.configured) return <ConfigNotice />;
  if (auth.loading) return <p className="muted">{t.common.loading}</p>;

  if (request) {
    return (
      <RequestView
        tracked={request}
        busy={busy}
        onCancel={cancelRequest}
        onExpire={refreshRequest}
        onAnother={backToList}
        onNew={newSearch}
      />
    );
  }

  const zoneLabel = (z: { fr: string; ar: string }) => z[locale];
  const wrongRole = auth.user && auth.role && auth.role !== "patient";

  return (
    <div className="stack-lg">
      <section className="card">
        <h2>{t.patient.zoneTitle}</h2>
        <div className="zone-grid" role="radiogroup" aria-label={t.patient.zoneTitle}>
          {ZONES.map((z) => (
            <button
              key={z.id}
              type="button"
              role="radio"
              aria-checked={zoneId === z.id}
              className={`chip ${zoneId === z.id ? "chip-on" : ""}`}
              onClick={() => setZoneId(z.id)}
            >
              {zoneLabel(z)}
            </button>
          ))}
        </div>
      </section>

      {zoneId && (
        <section className="card">
          <h2>{t.patient.clinicsTitle}</h2>
          {clinics === null ? (
            <p className="muted">{t.common.loading}</p>
          ) : clinics.length === 0 ? (
            <InfoNotice tone="warn">{t.patient.noClinics}</InfoNotice>
          ) : (
            <ul className="clinic-list">
              {clinics.map((c) => (
                <li key={c.id} className={`clinic ${selected?.id === c.id ? "clinic-on" : ""}`}>
                  <div>
                    <strong>{c.clinic_name}</strong>
                    <div className="muted">{c.dentist_name}</div>
                    <div className="badge badge-ok">
                      {fmt(t.patient.availableFor, { n: minutesUntil(c.available_until) })}
                    </div>
                  </div>
                  <button className="btn btn-primary" onClick={() => setSelected(c)}>
                    {t.patient.choose}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {selected && wrongRole && <InfoNotice tone="warn">{t.patient.wrongRole}</InfoNotice>}

      {selected && !auth.user && <EmailOtpLogin redirectPath={`/${locale}/patient`} />}

      {selected && auth.user && auth.role === "patient" && (
        <form className="card stack" onSubmit={sendRequest}>
          <h2>{t.patient.requestTitle}</h2>
          <p>
            <strong>{fmt(t.patient.selectedClinic, { clinic: selected.clinic_name })}</strong>
          </p>
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
            <span className="label">{t.patient.phoneOptional}</span>
            <input
              className="input"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              pattern="[0-9+ ()\-]{6,30}"
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
          <button className="btn btn-danger btn-lg" disabled={busy || !consent || !firstName.trim()}>
            {busy ? t.patient.sending : t.patient.send}
          </button>
          <p className="muted small">{t.patient.loggedAs.replace("{email}", auth.user.email ?? "")}</p>
        </form>
      )}

      <ErrorNotice error={error} />
    </div>
  );
}

function RequestView({
  tracked,
  busy,
  onCancel,
  onExpire,
  onAnother,
  onNew,
}: {
  tracked: Tracked;
  busy: boolean;
  onCancel: () => void;
  onExpire: () => void;
  onAnother: () => void;
  onNew: () => void;
}) {
  const { t } = useT();
  const { data, receivedAt } = tracked;
  const left = useCountdown(data.seconds_left, receivedAt, onExpire);

  if (data.status === "pending") {
    return (
      <section className="card center stack" aria-live="polite">
        <h2>{fmt(t.patient.waitingTitle, { clinic: data.clinic_name })}</h2>
        <div className="countdown" aria-label={`${left} ${t.common.sec}`}>
          {formatCountdown(left)}
        </div>
        <div className="bar">
          <div className="bar-fill" style={{ width: `${Math.min(100, (left / 60) * 100)}%` }} />
        </div>
        <p className="muted">{t.patient.waitingText}</p>
        <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>
          {t.patient.cancelRequest}
        </button>
      </section>
    );
  }

  if (data.status === "accepted" && data.clinic) {
    const c = data.clinic;
    return (
      <section className="card stack" aria-live="polite">
        <h2 className="ok-title">{t.patient.acceptedTitle}</h2>
        <p>{t.patient.acceptedText}</p>
        <div className="detail">
          <strong>{c.clinic_name}</strong>
          <div>{c.dentist_name}</div>
          <div className="muted">
            {t.patient.address} : {c.address}
          </div>
        </div>
        <div className="row">
          <a className="btn btn-primary btn-lg" href={telUrl(c.phone)}>
            {t.patient.call} · <span dir="ltr">{c.phone}</span>
          </a>
          <a className="btn btn-secondary btn-lg" href={directionsUrl(c)} target="_blank" rel="noopener noreferrer">
            {t.patient.directions}
          </a>
        </div>
        <button className="link-btn" onClick={onNew}>
          {t.patient.newSearch}
        </button>
      </section>
    );
  }

  const title =
    data.status === "declined"
      ? t.patient.declinedTitle
      : data.status === "expired"
        ? t.patient.expiredTitle
        : t.patient.cancelledTitle;

  return (
    <section className="card center stack" aria-live="polite">
      <h2>{title}</h2>
      <button className="btn btn-primary btn-lg" onClick={onAnother}>
        {t.patient.tryAnother}
      </button>
    </section>
  );
}
