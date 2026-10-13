"use client";

import { useT } from "@/lib/useLocale";
import { Principles } from "./TabBar";

export default function ProfileTab({
  role,
  name,
  email,
  onLogout,
}: {
  role: "patient" | "dentist" | "admin";
  name?: string;
  email: string;
  onLogout: () => void;
}) {
  const { t } = useT();
  return (
    <div className="stack-lg">
      <div className="page-heading">
        <h2>{t.profilePage.title}</h2>
        <p>{t.profilePage.roles[role]}</p>
      </div>
      <section className="card stack">
        {name && <h3 style={{ fontSize: "1.2rem", margin: 0 }}>{name}</h3>}
        <span dir="ltr">{email}</span>
        <button className="btn btn-ghost" onClick={onLogout}>
          {t.common.logout}
        </button>
      </section>
      <Principles text={t.profilePage.principles} />
    </div>
  );
}
