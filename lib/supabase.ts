import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** Noms des variables publiques absentes au moment de la compilation (jamais leurs valeurs). */
export function missingSupabaseVars(): string[] {
  const missing: string[] = [];
  // Références écrites en toutes lettres : Next.js ne remplace que ces formes-là.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  return missing;
}

export function isSupabaseConfigured(): boolean {
  return missingSupabaseVars().length === 0;
}

/** Client navigateur. N'utilise que la clé publique (publishable) : la sécurité repose sur la base. */
export function getSupabase(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      throw new Error("supabase_not_configured");
    }
    client = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}
