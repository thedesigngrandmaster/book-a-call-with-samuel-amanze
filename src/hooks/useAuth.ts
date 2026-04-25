import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "user";

export interface AuthState {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  loading: boolean;
}

export function useAuth(): AuthState & {
  signOut: () => Promise<void>;
  signInWithMagicLink: (email: string, fullName?: string) => Promise<{ error: string | null }>;
} {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        // defer role fetch
        setTimeout(() => fetchRole(s.user.id), 0);
      } else {
        setRole(null);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) fetchRole(data.session.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function fetchRole(userId: string) {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .order("role", { ascending: true });
    if (data && data.length) {
      const isAdmin = data.some((r) => r.role === "admin");
      setRole(isAdmin ? "admin" : "user");
    } else {
      setRole("user");
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function signInWithMagicLink(email: string, fullName?: string) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: fullName ? { full_name: fullName } : undefined,
      },
    });
    return { error: error?.message ?? null };
  }

  return {
    session,
    user: session?.user ?? null,
    role,
    loading,
    signOut,
    signInWithMagicLink,
  };
}
