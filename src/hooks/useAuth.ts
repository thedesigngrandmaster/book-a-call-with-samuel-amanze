
import { useEffect, useState, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "user";

export interface AuthState {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  loading: boolean;
  roleLoading: boolean;
}

const PENDING_BOOKING_KEY = "pending_booking_v1";

export type PendingBooking = {
  name: string;
  email: string;
  notes?: string;
  startsAt: string; 
  duration: number;
};

export function savePendingBooking(data: PendingBooking) {
  try {
    sessionStorage.setItem(PENDING_BOOKING_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function loadPendingBooking(): PendingBooking | null {
  try {
    const raw = sessionStorage.getItem(PENDING_BOOKING_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingBooking;
  } catch {
    return null;
  }
}

export function clearPendingBooking() {
  try {
    sessionStorage.removeItem(PENDING_BOOKING_KEY);
  } catch {
    /* ignore */
  }
}

export function useAuth(): AuthState & {
  signOut: () => Promise<void>;
  signInWithMagicLink: (
    email: string,
    fullName?: string,
    redirectPath?: string
  ) => Promise<{ error: string | null }>;
} {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(true);

  const fetchRole = useCallback(async (userId: string) => {
    try {
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
    } catch {
      setRole("user");
    } finally {
      setRoleLoading(false);
    }
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);

      if (s?.user) {
        setRoleLoading(true);
        setTimeout(() => fetchRole(s.user.id), 0);
      } else {
        setRole(null);
        setRoleLoading(false);
      }

      if (event === "SIGNED_IN" && s?.user) {}
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        fetchRole(data.session.user.id);
      } else {
        setRoleLoading(false);
      }
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, [fetchRole]);

  async function signOut() {
    clearPendingBooking();
    await supabase.auth.signOut();
  }


  async function signInWithMagicLink(
    email: string,
    fullName?: string,
    redirectPath: string = "/"
  ) {
    const origin = window.location.origin;
    const emailRedirectTo = `${origin}${redirectPath.startsWith("/") ? redirectPath : `/${redirectPath}`}`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo,
        shouldCreateUser: true,
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
    roleLoading,
    signOut,
    signInWithMagicLink,
  };
}
