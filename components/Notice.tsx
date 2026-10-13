"use client";

import { useT } from "@/lib/useLocale";
import { errorCode } from "@/lib/errors";

export function ErrorNotice({ error }: { error: unknown }) {
  const { t } = useT();
  if (!error) return null;
  const code = errorCode(error);
  return (
    <div className="alert alert-error" role="alert">
      {t.errors[code]}
    </div>
  );
}

export function InfoNotice({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "ok" | "warn" }) {
  return (
    <div className={`alert alert-${tone}`} role="status">
      {children}
    </div>
  );
}

export function ConfigNotice() {
  const { t } = useT();
  return (
    <div className="alert alert-warn" role="alert">
      {t.errors.supabase_not_configured}
    </div>
  );
}
