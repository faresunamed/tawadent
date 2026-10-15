"use client";

import { useState } from "react";
import { useT } from "@/lib/useLocale";

/** Champ mot de passe avec icône pour afficher / masquer la saisie. */
export default function PasswordField({
  value,
  onChange,
  autoComplete,
  minLength,
}: {
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  minLength?: number;
}) {
  const { t } = useT();
  const [shown, setShown] = useState(false);
  return (
    <div className="pw-wrap">
      <input
        className="input"
        type={shown ? "text" : "password"}
        autoComplete={autoComplete}
        required
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        dir="ltr"
        style={{ paddingInlineEnd: 48 }}
      />
      <button
        type="button"
        className="pw-eye"
        onClick={() => setShown(!shown)}
        aria-label={shown ? t.common.hidePassword : t.common.showPassword}
        aria-pressed={shown}
      >
        {shown ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17.94 17.94A10.9 10.9 0 0112 20c-7 0-11-8-11-8a19.8 19.8 0 015.06-5.94M9.9 4.24A10.9 10.9 0 0112 4c7 0 11 8 11 8a19.8 19.8 0 01-3.17 4.19M14.12 14.12a3 3 0 11-4.24-4.24M1 1l22 22" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
