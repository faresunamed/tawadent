"use client";

import { useT } from "@/lib/useLocale";
import { errorCode, rawMessage } from "@/lib/errors";
import { missingSupabaseVars } from "@/lib/supabase";

function projectHost(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").host;
  } catch {
    return "?";
  }
}

export function ErrorNotice({ error }: { error: unknown }) {
  const { t } = useT();
  if (!error) return null;
  const code = errorCode(error);
  return (
    <div className="alert alert-error" role="alert">
      {t.errors[code]}
      {code === "invalid_credentials" && (
        <div className="small" dir="ltr" style={{ marginTop: 6, opacity: 0.8 }}>
          <code>{projectHost()}</code>
        </div>
      )}
      {code === "unknown" && rawMessage(error) && (
        <div className="small" dir="ltr" style={{ marginTop: 6, opacity: 0.8 }}>
          <code>{rawMessage(error)}</code>
        </div>
      )}
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
  const missing = missingSupabaseVars();
  return (
    <div className="alert alert-warn" role="alert">
      {t.errors.supabase_not_configured}
      {missing.length > 0 && (
        <div className="small" dir="ltr" style={{ marginTop: 6 }}>
          <code>{missing.join(", ")}</code>
        </div>
      )}
    </div>
  );
}
