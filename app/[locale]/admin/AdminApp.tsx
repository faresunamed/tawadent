"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { useT } from "@/lib/useLocale";
import { zoneName } from "@/lib/zones";
import { minutesUntil } from "@/lib/time";
import type { AdminDentist, AdminOverview, AdminRecentRequest, AuditEvent, DentistStatus } from "@/lib/types";
import PasswordAuth from "@/components/PasswordAuth";
import TabBar, { ICONS } from "@/components/TabBar";
import ProfileTab from "@/components/ProfileTab";
import { ConfigNotice, ErrorNotice, InfoNotice } from "@/components/Notice";

const STATUSES: DentistStatus[] = ["pending", "approved", "suspended", "rejected"];

export default function AdminApp() {
  const { t, locale } = useT();
  const auth = useAuth();

  if (!auth.configured) return <ConfigNotice />;
  if (auth.loading) return <p className="muted">{t.common.loading}</p>;
  if (!auth.user) {
    return <PasswordAuth title={t.admin.loginTitle} allowSignup={false} redirectPath={`/${locale}/admin`} />;
  }
  if (auth.role !== "admin") {
    return (
      <div className="stack">
        <InfoNotice tone="warn">{t.admin.notAdmin}</InfoNotice>
        <button className="btn btn-ghost" onClick={auth.signOut}>
          {t.common.logout}
        </button>
      </div>
    );
  }
  return <AdminDashboard onLogout={auth.signOut} email={auth.user.email ?? ""} />;
}

function AdminDashboard({ onLogout, email }: { onLogout: () => void; email: string }) {
  const { t, locale } = useT();
  const [tab, setTab] = useState("validation");
  const [filter, setFilter] = useState<DentistStatus | "all">("pending");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [dentists, setDentists] = useState<AdminDentist[] | null>(null);
  const [recent, setRecent] = useState<AdminRecentRequest[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = getSupabase();
    const [o, d, r, a] = await Promise.all([
      sb.rpc("admin_overview"),
      sb.rpc("admin_list_dentists", { p_status: filter === "all" ? null : filter }),
      sb.rpc("admin_recent_requests"),
      sb.rpc("admin_audit"),
    ]);
    const err = o.error || d.error || r.error || a.error;
    if (err) setError(err);
    else setError(null);
    if (o.data) setOverview(o.data as AdminOverview);
    if (d.data) setDentists(d.data as AdminDentist[]);
    if (r.data) setRecent(r.data as AdminRecentRequest[]);
    if (a.data) setAudit(a.data as AuditEvent[]);
  }, [filter]);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  async function setStatus(d: AdminDentist, status: DentistStatus, askNote: boolean) {
    let note: string | null = null;
    if (askNote) {
      note = window.prompt(t.admin.notePrompt, "");
      if (note === null) return; // annulé
    }
    if (!askNote && !window.confirm(t.admin.confirmDecision)) return;
    setBusyId(d.id);
    const { error } = await getSupabase().rpc("admin_set_dentist_status", {
      p_dentist: d.id,
      p_status: status,
      p_note: note,
    });
    if (error) setError(error);
    setBusyId(null);
    await load();
  }

  const stat = (label: string, value: number | undefined) => (
    <div className="stat" key={label}>
      <div className="stat-value">{value ?? 0}</div>
      <div className="muted small">{label}</div>
    </div>
  );

  const tabs = [
    { id: "validation", label: t.tabs.admin, icon: ICONS.shield },
    { id: "activity", label: t.tabs.activity, icon: ICONS.receipt },
    { id: "profile", label: t.tabs.profile, icon: ICONS.person },
  ];

  return (
    <div className="with-tabs">
      {tab === "validation" && (
    <div className="stack-lg">
      <h2>{t.admin.overview}</h2>

      <section className="card stack">
        <div className="stats">
          {stat(t.admin.availableNow, overview?.available_now)}
          {stat(t.admin.activeRequests, overview?.active_requests)}
          {STATUSES.map((s) => stat(`${t.admin.dentistsByStatus} · ${t.dentist.statusLabels[s]}`, overview?.dentists[s]))}
        </div>
        <h3>{t.admin.requests24h}</h3>
        <div className="stats">
          {(Object.keys(t.requestStatus) as (keyof typeof t.requestStatus)[]).map((s) =>
            stat(t.requestStatus[s], overview?.requests_24h[s])
          )}
        </div>
      </section>

      <section className="card stack">
        <div className="row between">
          <h2>{t.admin.dentistsTitle}</h2>
          <select className="input auto" value={filter} onChange={(e) => setFilter(e.target.value as DentistStatus | "all")}>
            <option value="all">{t.admin.filterAll}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t.dentist.statusLabels[s]}
              </option>
            ))}
          </select>
        </div>
        {dentists === null ? (
          <p className="muted">{t.common.loading}</p>
        ) : dentists.length === 0 ? (
          <p className="muted">{t.admin.noDentists}</p>
        ) : (
          <ul className="admin-list">
            {dentists.map((d) => (
              <li key={d.id} className="admin-item">
                <div className="row between">
                  <strong>{d.clinic_name}</strong>
                  <span className={`badge badge-${d.status}`}>{t.dentist.statusLabels[d.status]}</span>
                </div>
                <div>{d.full_name}</div>
                <div className="muted small">
                  {zoneName(d.zone_id, locale)} · {d.address}
                </div>
                <div className="small" dir="ltr">
                  {d.email} · {d.phone}
                </div>
                <div className="small">
                  {t.admin.orderNumber} : <strong dir="ltr">{d.order_number}</strong>
                  {d.available_until && minutesUntil(d.available_until) > 0 && (
                    <span className="badge badge-ok">{minutesUntil(d.available_until)} {t.common.min}</span>
                  )}
                </div>
                {d.status_note && <div className="muted small">“{d.status_note}”</div>}
                <div className="row">
                  {(d.status === "pending" || d.status === "rejected") && (
                    <button className="btn btn-primary" disabled={busyId === d.id} onClick={() => setStatus(d, "approved", false)}>
                      {t.admin.approve}
                    </button>
                  )}
                  {d.status === "pending" && (
                    <button className="btn btn-ghost" disabled={busyId === d.id} onClick={() => setStatus(d, "rejected", true)}>
                      {t.admin.reject}
                    </button>
                  )}
                  {d.status === "approved" && (
                    <button className="btn btn-danger" disabled={busyId === d.id} onClick={() => setStatus(d, "suspended", true)}>
                      {t.admin.suspend}
                    </button>
                  )}
                  {d.status === "suspended" && (
                    <button className="btn btn-primary" disabled={busyId === d.id} onClick={() => setStatus(d, "approved", false)}>
                      {t.admin.reactivate}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ErrorNotice error={error} />
    </div>
      )}

      {tab === "activity" && (
    <div className="stack-lg">
      <section className="card stack">
        <h2>{t.admin.recentTitle}</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t.admin.colTime}</th>
                <th>{t.admin.colClinic}</th>
                <th>{t.admin.colZone}</th>
                <th>{t.admin.colStatus}</th>
                <th>{t.admin.colResponse}</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id}>
                  <td>
                    {new Date(r.created_at).toLocaleString(locale === "ar" ? "ar-TN" : "fr-TN", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td>{r.clinic_name}</td>
                  <td>{zoneName(r.zone_id, locale)}</td>
                  <td>{t.requestStatus[r.status]}</td>
                  <td dir="ltr">{r.response_seconds ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card stack">
        <h2>{t.admin.activityTitle}</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t.admin.colTime}</th>
                <th>{t.admin.colEvent}</th>
                <th>{t.admin.colClinic}</th>
                <th>{t.admin.colZone}</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((e) => (
                <tr key={e.id}>
                  <td>
                    {new Date(e.at).toLocaleString(locale === "ar" ? "ar-TN" : "fr-TN", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td>{(t.admin.events as Record<string, string>)[e.action] ?? e.action}</td>
                  <td>{e.clinic_name ?? "—"}</td>
                  <td>{e.zone_id ? zoneName(e.zone_id, locale) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ErrorNotice error={error} />
    </div>
      )}

      {tab === "profile" && <ProfileTab role="admin" email={email} onLogout={onLogout} />}

      <TabBar tabs={tabs} active={tab} onChange={setTab} />
    </div>
  );
}
