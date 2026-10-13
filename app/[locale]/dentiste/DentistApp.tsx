"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { useT } from "@/lib/useLocale";
import { useCountdown } from "@/lib/useCountdown";
import { fmt } from "@/lib/i18n";
import { ZONES, zoneName } from "@/lib/zones";
import { telUrl } from "@/lib/maps";
import { minutesUntil } from "@/lib/time";
import { normalizeTnPhone } from "@/lib/phone";
import { beep } from "@/lib/alert";
import type { DentistRow, InboxRequest } from "@/lib/types";
import PasswordAuth from "@/components/PasswordAuth";
import { ConfigNotice, ErrorNotice, InfoNotice } from "@/components/Notice";

export default function DentistApp() {
  const { t, locale } = useT();
  const auth = useAuth();

  if (!auth.configured) return <ConfigNotice />;
  if (auth.loading) return <p className="muted">{t.common.loading}</p>;
  if (!auth.user) {
    return <PasswordAuth title={t.dentist.loginTitle} allowSignup redirectPath={`/${locale}/dentiste`} />;
  }
  if (auth.role !== "dentist") {
    return (
      <div className="stack">
        <InfoNotice tone="warn">{t.dentist.notDentist}</InfoNotice>
        <button className="btn btn-ghost" onClick={auth.signOut}>
          {t.common.logout}
        </button>
      </div>
    );
  }
  return <Dashboard userId={auth.user.id} email={auth.user.email ?? ""} onLogout={auth.signOut} />;
}

function Dashboard({ userId, email, onLogout }: { userId: string; email: string; onLogout: () => void }) {
  const { t, locale } = useT();
  const [row, setRow] = useState<DentistRow | null>(null);
  const [rowLoaded, setRowLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [inbox, setInbox] = useState<{ items: InboxRequest[]; receivedAt: number }>({ items: [], receivedAt: Date.now() });
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const seen = useRef<Set<string> | null>(null);

  const loadRow = useCallback(async () => {
    const { data, error } = await getSupabase().from("dentists").select("*").eq("id", userId).maybeSingle();
    if (error) setError(error);
    else {
      setRow((data as DentistRow | null) ?? null);
      if (!data) setEditing(true);
    }
    setRowLoaded(true);
  }, [userId]);

  const loadInbox = useCallback(async () => {
    const { data, error } = await getSupabase().rpc("dentist_requests");
    if (error) return;
    const items = (data as InboxRequest[]) ?? [];
    // Alerte sonore pour toute nouvelle demande en attente.
    const pendingIds = items.filter((i) => i.status === "pending").map((i) => i.id);
    if (seen.current === null) seen.current = new Set(items.map((i) => i.id));
    const fresh = pendingIds.filter((id) => !seen.current!.has(id));
    if (fresh.length) {
      beep();
      try {
        navigator.vibrate?.([200, 100, 200]);
      } catch {}
    }
    items.forEach((i) => seen.current!.add(i.id));
    setInbox({ items, receivedAt: Date.now() });
  }, []);

  useEffect(() => {
    loadRow();
  }, [loadRow]);

  const approved = row?.status === "approved";

  // Interrogation régulière + temps réel (filet de sécurité : la demande dure seulement 60 s).
  useEffect(() => {
    if (!approved) return;
    loadInbox();
    const poll = setInterval(loadInbox, 3000);
    const rowPoll = setInterval(loadRow, 20000);
    const sb = getSupabase();
    const channel = sb
      .channel(`dentist-requests-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "requests", filter: `dentist_id=eq.${userId}` },
        () => loadInbox()
      )
      .subscribe();
    return () => {
      clearInterval(poll);
      clearInterval(rowPoll);
      sb.removeChannel(channel);
    };
  }, [approved, userId, loadInbox, loadRow]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  const pending = inbox.items.filter((i) => i.status === "pending");
  const active = inbox.items.filter((i) => i.status === "accepted" || i.status === "arrived");
  useEffect(() => {
    if (!pending.length) return;
    const original = document.title;
    document.title = `🔔 ${t.dentist.incoming}`;
    return () => {
      document.title = original;
    };
  }, [pending.length, t.dentist.incoming]);

  async function setAvailability(active: boolean) {
    setBusy(true);
    setError(null);
    const { error } = await getSupabase().rpc("set_availability", { p_active: active });
    if (error) setError(error);
    await loadRow();
    setBusy(false);
  }

  async function respond(id: string, accept: boolean) {
    setBusy(true);
    setError(null);
    const { error } = await getSupabase().rpc("respond_request", { p_request: id, p_accept: accept });
    if (error) setError(error);
    await Promise.all([loadInbox(), loadRow()]);
    setBusy(false);
  }

  async function transition(fn: "complete_request" | "release_request", id: string, confirmText: string) {
    if (!window.confirm(confirmText)) return;
    setBusy(true);
    setError(null);
    const { error } = await getSupabase().rpc(fn, { p_request: id });
    if (error) setError(error);
    await Promise.all([loadInbox(), loadRow()]);
    setBusy(false);
  }

  if (!rowLoaded) return <p className="muted">{t.common.loading}</p>;

  const minutesLeft = minutesUntil(row?.available_until ?? null, now);
  const history = inbox.items.filter((i) => !["pending", "accepted", "arrived"].includes(i.status));
  const locked = active.length > 0 || pending.length > 0;

  return (
    <div className="stack-lg">
      <div className="row between">
        <span className="muted small" dir="ltr">
          {email}
        </span>
        <button className="btn btn-ghost" onClick={onLogout}>
          {t.common.logout}
        </button>
      </div>

      {row && !editing && (
        <section className="card stack">
          <div className="row between">
            <h2>{row.clinic_name}</h2>
            <span className={`badge badge-${row.status}`}>{t.dentist.statusLabels[row.status]}</span>
          </div>
          {row.status === "pending" && <InfoNotice>{t.dentist.statusPendingText}</InfoNotice>}
          {row.status === "suspended" && (
            <InfoNotice tone="warn">
              {t.dentist.statusSuspendedText}
              {row.status_note ? ` (${row.status_note})` : ""}
            </InfoNotice>
          )}
          {row.status === "rejected" && (
            <InfoNotice tone="warn">
              {t.dentist.statusRejectedText}
              {row.status_note ? ` (${row.status_note})` : ""}
            </InfoNotice>
          )}
          <p className="muted">
            {row.full_name} · {zoneName(row.zone_id, locale)} · {row.address}
          </p>
          <button className="btn btn-ghost" onClick={() => setEditing(true)} disabled={locked}>
            {t.dentist.editProfile}
          </button>
          {locked && <p className="muted small">{t.dentist.busyLocked}</p>}
        </section>
      )}

      {editing && (
        <ProfileForm
          initial={row}
          onSaved={async () => {
            setEditing(false);
            await loadRow();
          }}
          onCancel={row ? () => setEditing(false) : undefined}
        />
      )}

      {approved && !editing && (
        <>
          <section className="card stack">
            <h2>{t.dentist.availTitle}</h2>
            {minutesLeft > 0 ? (
              <InfoNotice tone="ok">{fmt(t.dentist.availOn, { n: minutesLeft })}</InfoNotice>
            ) : (
              <InfoNotice>{t.dentist.availOff}</InfoNotice>
            )}
            <div className="row">
              <button className="btn btn-primary btn-lg" disabled={busy || active.length > 0} onClick={() => setAvailability(true)}>
                {t.dentist.goAvailable}
              </button>
              {minutesLeft > 0 && (
                <button className="btn btn-ghost" disabled={busy || active.length > 0} onClick={() => setAvailability(false)}>
                  {t.dentist.goUnavailable}
                </button>
              )}
            </div>
            <p className="muted small">{t.dentist.availNote}</p>
          </section>

          {active.map((r) => (
            <section key={r.id} className="card stack" aria-live="polite">
              <div className="row between">
                <h2 className="ok-title">{r.status === "arrived" ? t.dentist.arrivedTitle : t.dentist.acceptedTitle}</h2>
                <span className="badge badge-ok">{t.requestStatus[r.status]}</span>
              </div>
              <p>
                {t.dentist.patientLabel} : <strong>{r.patient_first_name}</strong>
                {r.patient_phone && (
                  <>
                    {" · "}
                    <a href={telUrl(r.patient_phone)} dir="ltr">
                      {r.patient_phone}
                    </a>
                  </>
                )}
              </p>
              <p className="muted small">{t.dentist.reserved}</p>
              <div className="row">
                {r.status === "arrived" && (
                  <button
                    className="btn btn-primary btn-lg"
                    disabled={busy}
                    onClick={() => transition("complete_request", r.id, t.dentist.completeConfirm)}
                  >
                    {t.dentist.complete}
                  </button>
                )}
                {r.status === "accepted" && (
                  <button
                    className="btn btn-ghost"
                    disabled={busy}
                    onClick={() => transition("release_request", r.id, t.dentist.releaseConfirm)}
                  >
                    {t.dentist.release}
                  </button>
                )}
              </div>
            </section>
          ))}

          <section className="card stack" aria-live="assertive">
            <h2>{t.dentist.inboxTitle}</h2>
            {pending.length === 0 && <p className="muted">{t.dentist.noRequests}</p>}
            {pending.map((r) => (
              <IncomingRequest key={r.id} r={r} receivedAt={inbox.receivedAt} busy={busy} onRespond={respond} onExpire={loadInbox} />
            ))}
          </section>

          {history.length > 0 && (
            <section className="card stack">
              <h2>{t.dentist.history}</h2>
              <ul className="history">
                {history.map((r) => (
                  <li key={r.id} className="row between">
                    <span>
                      {r.patient_first_name} · {zoneName(r.zone_id, locale)}
                    </span>
                    <span className="muted small">
                      {new Date(r.created_at).toLocaleTimeString(locale === "ar" ? "ar-TN" : "fr-TN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · {t.requestStatus[r.status]}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <ErrorNotice error={error} />
    </div>
  );
}

function IncomingRequest({
  r,
  receivedAt,
  busy,
  onRespond,
  onExpire,
}: {
  r: InboxRequest;
  receivedAt: number;
  busy: boolean;
  onRespond: (id: string, accept: boolean) => void;
  onExpire: () => void;
}) {
  const { t } = useT();
  const left = useCountdown(r.seconds_left, receivedAt, onExpire);
  return (
    <div className="incoming">
      <div className="row between">
        <strong>{t.dentist.incoming}</strong>
        <span className="countdown-sm">{fmt(t.dentist.timeLeft, { n: left })}</span>
      </div>
      <div className="bar">
        <div className="bar-fill" style={{ width: `${Math.min(100, (left / 60) * 100)}%` }} />
      </div>
      <p>
        {t.dentist.patientLabel} : <strong>{r.patient_first_name}</strong>
        {r.patient_phone && (
          <>
            {" · "}
            <a href={telUrl(r.patient_phone)} dir="ltr">
              {r.patient_phone}
            </a>
          </>
        )}
      </p>
      <div className="row">
        <button className="btn btn-primary btn-lg" disabled={busy || left === 0} onClick={() => onRespond(r.id, true)}>
          {t.dentist.accept}
        </button>
        <button className="btn btn-ghost" disabled={busy || left === 0} onClick={() => onRespond(r.id, false)}>
          {t.dentist.decline}
        </button>
      </div>
    </div>
  );
}

function ProfileForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial: DentistRow | null;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const { t, locale } = useT();
  const [form, setForm] = useState({
    full_name: initial?.full_name ?? "",
    clinic_name: initial?.clinic_name ?? "",
    address: initial?.address ?? "",
    zone_id: initial?.zone_id ?? "",
    phone: initial?.phone ?? "",
    latitude: initial?.latitude != null ? String(initial.latitude) : "",
    longitude: initial?.longitude != null ? String(initial.longitude) : "",
    order_number: initial?.order_number ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const num = (v: string) => {
    const n = Number(v.replace(",", "."));
    return v.trim() !== "" && Number.isFinite(n) ? n : null;
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const phone = normalizeTnPhone(form.phone);
    if (!phone) {
      setError(new Error("invalid_input"));
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await getSupabase().rpc("save_dentist_profile", {
      p_full_name: form.full_name,
      p_clinic_name: form.clinic_name,
      p_address: form.address,
      p_zone_id: form.zone_id,
      p_phone: phone,
      p_latitude: num(form.latitude),
      p_longitude: num(form.longitude),
      p_order_number: form.order_number,
    });
    setBusy(false);
    if (error) setError(error);
    else onSaved();
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <h2>{t.dentist.profileTitle}</h2>
      <p className="muted">{t.dentist.profileIntro}</p>
      <label className="field">
        <span className="label">{t.dentist.fullName}</span>
        <input className="input" required minLength={2} maxLength={120} value={form.full_name} onChange={set("full_name")} />
      </label>
      <label className="field">
        <span className="label">{t.dentist.clinicName}</span>
        <input className="input" required minLength={2} maxLength={120} value={form.clinic_name} onChange={set("clinic_name")} />
      </label>
      <label className="field">
        <span className="label">{t.dentist.address}</span>
        <input className="input" required minLength={5} maxLength={250} value={form.address} onChange={set("address")} />
      </label>
      <label className="field">
        <span className="label">{t.dentist.zone}</span>
        <select className="input" required value={form.zone_id} onChange={set("zone_id")}>
          <option value="">{t.dentist.zonePlaceholder}</option>
          {ZONES.map((z) => (
            <option key={z.id} value={z.id}>
              {z[locale]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="label">{t.dentist.phone}</span>
        <input
          className="input"
          type="tel"
          inputMode="tel"
          required
          pattern="[0-9+ ()\-]{8,30}"
          placeholder="71 000 010"
          value={form.phone}
          onChange={set("phone")}
          dir="ltr"
        />
        <span className="help">{t.dentist.phoneHelp}</span>
      </label>
      <div className="grid-2">
        <label className="field">
          <span className="label">{t.dentist.latitude}</span>
          <input className="input" inputMode="decimal" value={form.latitude} onChange={set("latitude")} dir="ltr" />
        </label>
        <label className="field">
          <span className="label">{t.dentist.longitude}</span>
          <input className="input" inputMode="decimal" value={form.longitude} onChange={set("longitude")} dir="ltr" />
        </label>
      </div>
      <p className="help">{t.dentist.gpsHelp}</p>
      <label className="field">
        <span className="label">{t.dentist.orderNumber}</span>
        <input className="input" required minLength={2} maxLength={60} value={form.order_number} onChange={set("order_number")} dir="ltr" />
        {initial && <span className="help">{t.dentist.orderChangeWarning}</span>}
      </label>
      <div className="row">
        <button className="btn btn-primary" disabled={busy}>
          {t.dentist.saveProfile}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            {t.common.cancel}
          </button>
        )}
      </div>
      <ErrorNotice error={error} />
    </form>
  );
}
