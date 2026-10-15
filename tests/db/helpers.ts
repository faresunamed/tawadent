import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

// Imite ce que Supabase fournit : schéma auth, auth.uid(), rôles anon/authenticated.
const SUPABASE_STUB = `
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    email_confirmed_at timestamptz,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create role anon nologin;
  create role authenticated nologin;
  grant usage on schema public to anon, authenticated;
  grant usage on schema auth to anon, authenticated;
  create publication supabase_realtime;
`;

export type Db = {
  pg: PGlite;
  newUser: (email: string, role?: string) => Promise<string>;
  /** Exécute `fn` comme un utilisateur connecté (rôle authenticated + auth.uid()). */
  as: <T>(uid: string, fn: () => Promise<T>) => Promise<T>;
  /** Exécute `fn` comme visiteur anonyme. */
  asAnon: <T>(fn: () => Promise<T>) => Promise<T>;
  /** Requête en superutilisateur (pour préparer / forcer l'état, ex. faire expirer). */
  admin: (sql: string, params?: unknown[]) => Promise<any[]>;
  call: (sql: string, params?: unknown[]) => Promise<any[]>;
};

export async function createDb(): Promise<Db> {
  const pg = new PGlite();
  await pg.exec(SUPABASE_STUB);
  const dir = join(process.cwd(), "supabase/migrations");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    await pg.exec(readFileSync(join(dir, f), "utf8"));
  }

  const run = async (sql: string, params?: unknown[]) => (await pg.query(sql, params)).rows as any[];

  const as = async <T>(uid: string, fn: () => Promise<T>) => {
    await pg.exec(`select set_config('request.jwt.claim.sub', '${uid}', false); set role authenticated;`);
    try {
      return await fn();
    } finally {
      await pg.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
    }
  };
  const asAnon = async <T>(fn: () => Promise<T>) => {
    await pg.exec(`select set_config('request.jwt.claim.sub', '', false); set role anon;`);
    try {
      return await fn();
    } finally {
      await pg.exec(`reset role;`);
    }
  };

  const newUser = async (email: string, role?: string) => {
    const id = randomUUID();
    const meta = role ? JSON.stringify({ role }) : "{}";
    await pg.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3::jsonb)`, [
      id,
      email,
      meta,
    ]);
    return id;
  };

  return { pg, newUser, as, asAnon, admin: run, call: run };
}

export const PROFILE = {
  full: ["Dr Test", "Cabinet Test", "12 rue du Lac, Tunis", "lac-1", "+216 20 000 000", 36.83, 10.24, "ORDRE-1234"],
};
