import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  CalendarDaysIcon,
  BellIcon,
  ArrowRightOnRectangleIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export default function TopBar() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user || role !== "admin") return;
    let active = true;
    const load = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .eq("read", false);
      if (active) setUnread(count ?? 0);
    };
    load();
    const channel = supabase
      .channel("notif-count")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${user.id}` },
        load,
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [user, role]);

  const initials = (user?.user_metadata?.full_name || user?.email || "?")
    .split(/\s+/)
    .map((w: string) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <CalendarDaysIcon className="h-6 w-6 text-accent" />
          <span className="text-sm font-semibold tracking-tight">
            Samuel AMANZE<span className="text-muted-foreground">'s Calendar</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          {role === "admin" && (
            <button
              onClick={() => navigate("/admin/notifications")}
              className="relative rounded-full p-2 hover:bg-secondary"
              aria-label="Notifications"
            >
              <BellIcon className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute -left-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </button>
          )}

          {user ? (
            <>
              {role === "admin" && (
                <Link to="/admin" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
                  Admin
                </Link>
              )}
              <Link to="/samuel" className="flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-3 hover:bg-surface-hover">
                {role === "admin" ? (
                  <img
                    src="/me.jpg"
                    alt="Samuel AMANZE"
                    className="h-7 w-7 rounded-full object-cover ring-2 ring-accent/40"
                  />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-foreground">
                    {initials}
                  </span>
                )}
                <span className="hidden text-xs text-muted-foreground sm:block">
                  {role === "admin" ? "Samuel AMANZE" : user.email}
                </span>
              </Link>
              <button
                onClick={signOut}
                className="rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                aria-label="Sign out"
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5" />
              </button>
            </>
          ) : (
            <Link to="/auth" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
