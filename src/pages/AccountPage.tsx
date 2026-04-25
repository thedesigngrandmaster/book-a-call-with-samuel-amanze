import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { CalendarDaysIcon, VideoCameraIcon } from "@heroicons/react/24/outline";

export default function AccountPage() {
  const { user, loading } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("bookings")
      .select("*")
      .eq("visitor_id", user.id)
      .order("starts_at", { ascending: true })
      .then(({ data }) => setBookings(data ?? []));
  }, [user]);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="panel p-6">
        <h1 className="text-xl font-semibold">My bookings</h1>
        <p className="text-sm text-muted-foreground">{user.email}</p>

        <ul className="mt-6 space-y-2">
          {bookings.length === 0 && (
            <li className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              You have no bookings yet.{" "}
              <Link to="/" className="text-accent hover:underline">
                Schedule one
              </Link>
              .
            </li>
          )}
          {bookings.map((b) => (
            <li key={b.id} className="rounded-lg border border-border bg-surface-elevated p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <CalendarDaysIcon className="h-4 w-4 text-accent" />
                    {format(new Date(b.starts_at), "EEE, MMM d, yyyy · h:mm a")}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{b.duration_minutes} minute meeting</div>
                  {b.notes && <p className="mt-2 text-sm text-muted-foreground">{b.notes}</p>}
                </div>
                <div className="text-right">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      b.status === "confirmed" ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {b.status}
                  </span>
                  {b.meet_link && b.status === "confirmed" && (
                    <a
                      href={b.meet_link}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 flex items-center gap-1 text-xs text-accent hover:underline"
                    >
                      <VideoCameraIcon className="h-3.5 w-3.5" /> Join Meet
                    </a>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
