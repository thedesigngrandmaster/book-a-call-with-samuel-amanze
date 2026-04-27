import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format, isSameDay, startOfDay } from "date-fns";
import { CalendarDaysIcon, BellIcon, UserPlusIcon, TrashIcon, FunnelIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";

type StatusFilter = "all" | "confirmed" | "cancelled";

export default function AdminPage() {
  const { user, role, loading, roleLoading } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [recipients, setRecipients] = useState<any[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dayFilter, setDayFilter] = useState<string>(""); // yyyy-MM-dd

  const reload = async () => {
    const { data: b } = await supabase
      .from("bookings")
      .select("*")
      .order("starts_at", { ascending: true });
    setBookings(b ?? []);
    const { data: r } = await supabase.from("admin_recipients").select("*").order("created_at");
    setRecipients(r ?? []);
  };

  useEffect(() => {
    if (role === "admin") reload();
  }, [role]);

  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (dayFilter) {
        const d = new Date(b.starts_at);
        const target = new Date(dayFilter + "T00:00:00");
        if (!isSameDay(d, target)) return false;
      }
      return true;
    });
  }, [bookings, statusFilter, dayFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    filtered.forEach((b) => {
      const key = startOfDay(new Date(b.starts_at)).toISOString();
      const arr = map.get(key) || [];
      arr.push(b);
      map.set(key, arr);
    });
    return Array.from(map.entries());
  }, [filtered]);

  if (loading || roleLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (role !== "admin") return <Navigate to="/" replace />;

  async function addRecipient(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.includes("@")) return toast.error("Enter a valid email");
    const { error } = await supabase.from("admin_recipients").insert({ email: newEmail.trim().toLowerCase(), added_by: user!.id });
    if (error) return toast.error(error.message);
    setNewEmail("");
    reload();
  }
  async function removeRecipient(id: string) {
    const { error } = await supabase.from("admin_recipients").delete().eq("id", id);
    if (error) return toast.error(error.message);
    reload();
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Admin dashboard</h1>
          <p className="text-sm text-muted-foreground">All meetings, notifications, and settings.</p>
        </div>
        <Link to="/admin/notifications" className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-hover">
          <BellIcon className="h-4 w-4" /> Notifications
        </Link>
      </div>

      <section className="panel p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Meetings</h2>
          <div className="flex flex-wrap items-center gap-2">
            <FunnelIcon className="h-4 w-4 text-muted-foreground" />
            <div className="flex overflow-hidden rounded-md border border-border bg-surface-elevated text-xs">
              {(["all", "confirmed", "cancelled"] as StatusFilter[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 capitalize transition ${
                    statusFilter === s ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <input
              type="date"
              value={dayFilter}
              onChange={(e) => setDayFilter(e.target.value)}
              className="rounded-md border border-border bg-surface-elevated px-2 py-1 text-xs text-foreground"
            />
            {dayFilter && (
              <button onClick={() => setDayFilter("")} className="text-xs text-muted-foreground hover:text-foreground">
                Clear
              </button>
            )}
          </div>
        </div>

        {grouped.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No meetings match your filters.
          </p>
        ) : (
          <div className="space-y-6">
            {grouped.map(([day, items]) => (
              <div key={day}>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <CalendarDaysIcon className="h-3.5 w-3.5 text-accent" />
                  {format(new Date(day), "EEEE, MMMM d, yyyy")}
                </div>
                <ul className="space-y-2">
                  {items.map((b) => (
                    <li key={b.id} className="flex items-center justify-between rounded-lg border border-border bg-surface-elevated p-3">
                      <Link to={`/admin/bookings/${b.id}`} className="flex-1 hover:opacity-80">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {format(new Date(b.starts_at), "h:mm a")} – {format(new Date(b.ends_at), "h:mm a")}
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              b.status === "confirmed"
                                ? "bg-emerald-500/15 text-emerald-400"
                                : b.status === "cancelled"
                                  ? "bg-destructive/15 text-destructive"
                                  : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {b.status}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {b.visitor_name} · {b.visitor_email}
                        </div>
                      </Link>
                      {b.meet_link && b.status === "confirmed" && (
                        <a href={b.meet_link} target="_blank" rel="noreferrer" className="ml-3 text-xs text-accent hover:underline">
                          Join Meet ↗
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel mt-6 p-6">
        <h2 className="mb-2 text-lg font-semibold">Notification recipients</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          These email addresses receive meeting confirmations alongside the visitor.
        </p>
        <form onSubmit={addRecipient} className="mb-4 flex gap-2">
          <input
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="add-an-email@example.com"
            className="input flex-1"
            type="email"
          />
          <button className="flex items-center gap-1 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90">
            <UserPlusIcon className="h-4 w-4" /> Add
          </button>
        </form>
        <ul className="space-y-1.5">
          {recipients.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm">
              <span>{r.email}</span>
              <button onClick={() => removeRecipient(r.id)} className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-destructive">
                <TrashIcon className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
