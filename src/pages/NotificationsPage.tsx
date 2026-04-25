import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { BellIcon, CheckIcon } from "@heroicons/react/24/outline";

export default function NotificationsPage() {
  const { user, role, loading } = useAuth();
  const [items, setItems] = useState<any[]>([]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    setItems(data ?? []);
  };

  useEffect(() => {
    if (role === "admin") load();
  }, [user, role]);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (role !== "admin") return <Navigate to="/" replace />;

  async function markAllRead() {
    await supabase.from("notifications").update({ read: true }).eq("recipient_id", user!.id).eq("read", false);
    load();
  }
  async function markRead(id: string) {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    load();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="panel p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <BellIcon className="h-5 w-5 text-accent" /> Notifications
          </h1>
          <button onClick={markAllRead} className="text-xs text-muted-foreground hover:text-foreground">
            Mark all as read
          </button>
        </div>
        <ul className="space-y-2">
          {items.length === 0 && (
            <li className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No notifications yet.
            </li>
          )}
          {items.map((n) => (
            <li
              key={n.id}
              className={`flex items-start justify-between gap-3 rounded-lg border p-3 ${
                n.read ? "border-border bg-surface-elevated" : "border-accent/40 bg-accent/5"
              }`}
            >
              <Link
                to={n.booking_id ? "/admin" : "/admin/notifications"}
                onClick={() => !n.read && markRead(n.id)}
                className="flex-1"
              >
                <div className="text-sm font-medium">{n.title}</div>
                {n.body && <div className="text-xs text-muted-foreground">{n.body}</div>}
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </div>
              </Link>
              {!n.read && (
                <button onClick={() => markRead(n.id)} className="rounded p-1 text-muted-foreground hover:bg-secondary">
                  <CheckIcon className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
