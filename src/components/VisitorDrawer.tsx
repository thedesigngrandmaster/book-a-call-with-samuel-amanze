import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { XMarkIcon, EnvelopeIcon, UserIcon, CalendarDaysIcon } from "@heroicons/react/24/outline";

interface Props {
  open: boolean;
  onClose: () => void;
  visitorEmail: string;
  visitorName: string;
}

export default function VisitorDrawer({ open, onClose, visitorEmail, visitorName }: Props) {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !visitorEmail) return;
    setLoading(true);
    supabase
      .from("bookings")
      .select("*")
      .eq("visitor_email", visitorEmail)
      .order("starts_at", { ascending: false })
      .then(({ data }) => {
        setBookings(data ?? []);
        setLoading(false);
      });
  }, [open, visitorEmail]);

  if (!open) return null;
  const now = new Date();
  const upcoming = bookings.filter((b) => new Date(b.starts_at) >= now);
  const past = bookings.filter((b) => new Date(b.starts_at) < now);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto border-l border-border bg-background p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Visitor profile</h2>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-secondary" aria-label="Close">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="rounded-xl border border-border bg-surface-elevated p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/20 text-sm font-bold text-accent">
              {visitorName.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
            </span>
            <div>
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                <UserIcon className="h-3.5 w-3.5" /> {visitorName}
              </div>
              <a href={`mailto:${visitorEmail}`} className="flex items-center gap-1.5 text-xs text-accent hover:underline">
                <EnvelopeIcon className="h-3 w-3" /> {visitorEmail}
              </a>
            </div>
          </div>
        </div>

        {loading ? (
          <p className="mt-6 text-center text-xs text-muted-foreground">Loading…</p>
        ) : (
          <>
            <Section title={`Upcoming (${upcoming.length})`} items={upcoming} />
            <Section title={`Past (${past.length})`} items={past} muted />
          </>
        )}
      </aside>
    </div>
  );
}

function Section({ title, items, muted }: { title: string; items: any[]; muted?: boolean }) {
  return (
    <div className="mt-6">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">None</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((b) => (
            <li
              key={b.id}
              className={`flex items-center justify-between rounded-lg border border-border bg-surface-elevated p-3 text-xs ${
                muted ? "opacity-70" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <CalendarDaysIcon className="h-3.5 w-3.5 text-accent" />
                <span>{format(new Date(b.starts_at), "MMM d, yyyy · h:mm a")}</span>
              </div>
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
