"use client";

import type { ReactNode } from "react";

export type TabDef = { id: string; label: string; icon: ReactNode; badge?: number };

const svg = (d: string) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

export const ICONS = {
  clinic: svg("M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M15 9h.01M9 13h.01M15 13h.01M10 21v-4h4v4"),
  receipt: svg("M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6"),
  person: svg("M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0"),
  shield: svg("M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4"),
};

/** Barre d'onglets en bas de l'écran (équivalent de la NavigationBar de l'application Flutter). */
export default function TabBar({ tabs, active, onChange }: { tabs: TabDef[]; active: string; onChange: (id: string) => void }) {
  return (
    <nav className="tabbar" role="tablist">
      <div className="tabbar-inner">
        {tabs.map((tab) => (
          <button key={tab.id} role="tab" aria-selected={active === tab.id} className="tab" onClick={() => onChange(tab.id)}>
            <span className="tab-ico">
              {tab.icon}
              {tab.badge ? <span className="tab-dot">{tab.badge}</span> : null}
            </span>
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

/** Onglet « Profil » : compte, déconnexion et principes de la plateforme. */
export function Principles({ text }: { text: string }) {
  return (
    <div className="principles">
      <span style={{ color: "var(--primary)" }}>{ICONS.shield}</span>
      <span>{text}</span>
    </div>
  );
}
