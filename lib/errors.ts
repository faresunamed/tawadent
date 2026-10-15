/** Codes d'erreur renvoyés par les fonctions SQL -> clés de traduction. */
const KNOWN = [
  "not_authenticated",
  "not_a_patient",
  "not_a_dentist",
  "not_admin",
  "invalid_input",
  "rate_limited",
  "patient_has_active_request",
  "clinic_unavailable",
  "clinic_busy",
  "request_not_found",
  "dentist_not_approved",
  "dentist_not_found",
  "busy",
  "invalid_transition",
  "registration_used",
] as const;

// Erreurs de l'authentification Supabase (messages en anglais) -> codes internes.
const AUTH_PATTERNS: [RegExp, "invalid_credentials" | "invalid_code" | "email_rate_limit" | "email_not_confirmed"][] = [
  [/invalid login credentials/i, "invalid_credentials"],
  [/email not confirmed/i, "email_not_confirmed"],
  [/token has expired|otp.*(expired|invalid)|invalid.*(otp|token)/i, "invalid_code"],
  [/rate limit|too many requests|over_email_send_rate_limit|for security purposes|only request this after/i, "email_rate_limit"],
];

export type ErrorCode =
  | (typeof KNOWN)[number]
  | "supabase_not_configured"
  | "invalid_credentials"
  | "invalid_code"
  | "email_rate_limit"
  | "email_not_confirmed"
  | "unknown";

export function errorCode(err: unknown): ErrorCode {
  const msg = String((err as { message?: string } | null)?.message ?? err ?? "");
  if (msg.includes("supabase_not_configured")) return "supabase_not_configured";
  const found = KNOWN.find((k) => msg.includes(k));
  if (found) return found;
  const auth = AUTH_PATTERNS.find(([re]) => re.test(msg));
  return auth ? auth[1] : "unknown";
}

/** Message technique brut (pour le diagnostic), tronqué. */
export function rawMessage(err: unknown): string {
  const msg = String((err as { message?: string } | null)?.message ?? err ?? "");
  return msg.slice(0, 200);
}
