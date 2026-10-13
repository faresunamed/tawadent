"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "./supabase";

export type Role = "patient" | "dentist" | "admin";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const [roleReady, setRoleReady] = useState(false);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (!configured) {
      setSessionReady(true);
      return;
    }
    const sb = getSupabase();
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionReady(true);
    });
    const { data } = sb.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, [configured]);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!sessionReady) return;
    if (!userId) {
      setRole(null);
      setRoleReady(true);
      return;
    }
    let cancelled = false;
    setRoleReady(false);
    getSupabase()
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setRole((data?.role as Role | undefined) ?? null);
        setRoleReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionReady, userId]);

  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut();
  }, []);

  return {
    configured,
    session,
    user: session?.user ?? null,
    role,
    loading: !sessionReady || (Boolean(userId) && !roleReady),
    signOut,
  };
}
