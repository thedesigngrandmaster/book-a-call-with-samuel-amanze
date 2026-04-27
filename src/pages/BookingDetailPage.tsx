import { useEffect, useState } from "react";
import { useParams, Navigate, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, addMinutes } from "date-fns";
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  ClockIcon,
  EnvelopeIcon,
  UserIcon,
  VideoCameraIcon,
  XCircleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  IdentificationIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";
import SafeIcon from "@/components/SafeIcon";
import VisitorDrawer from "@/components/VisitorDrawer";

export default function BookingDetailPage() {
  const { id } = useParams();
  const { user, role, loading, roleLoading } = useAuth();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");

  useEffect(() => {
    if (!id || role !== "admin") return;
    supabase
      .from("bookings")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        setBooking(data);
        if (data) {
          const s = new Date(data.starts_at);
          setNewDate(format(s, "yyyy-MM-dd"));
          setNewTime(format(s, "HH:mm"));
        }
      });

    // Mark related notifications as read
    supabase
      .from("notifications")
      .update({ read: true })
      .eq("booking_id", id)
      .eq("recipient_id", user!.id)
      .then(() => {});
  }, [id, role, user]);

  if (loading || roleLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (role !== "admin") return <Navigate to="/" replace />;

  async function cancel() {
    if (!booking) return;
    if (!confirm("Cancel this meeting? The visitor will be notified.")) return;
    setBusy(true);
    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", booking.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Meeting cancelled");
    setBooking({ ...booking, status: "cancelled" });
    supabase.functions.invoke("send-booking-emails", {
      body: { bookingId: booking.id, kind: "cancelled" },
    }).catch(() => {});
  }

  async function reschedule() {
    if (!booking) return;
    if (!newDate || !newTime) return toast.error("Pick a date and time");
    const newStart = new Date(`${newDate}T${newTime}:00`);
    if (isNaN(newStart.getTime())) return toast.error("Invalid date/time");
    const newEnd = addMinutes(newStart, booking.duration_minutes);

    setBusy(true);
    try {
      // Try to create a fresh Meet event for the new time
      let meetLink: string | null = booking.meet_link;
      try {
        const { data: meet } = await supabase.functions.invoke("create-meet-event", {
          body: {
            bookingId: booking.id,
            summary: `Quick chat with ${booking.visitor_name} (rescheduled)`,
            description: booking.notes || "",
            startsAt: newStart.toISOString(),
            endsAt: newEnd.toISOString(),
            visitorEmail: booking.visitor_email,
            visitorName: booking.visitor_name,
          },
        });
        if (meet?.meetLink) meetLink = meet.meetLink;
      } catch (e) {
        console.warn("Meet recreate failed, keeping existing link", e);
      }

      const { error } = await supabase
        .from("bookings")
        .update({
          starts_at: newStart.toISOString(),
          ends_at: newEnd.toISOString(),
          meet_link: meetLink,
          status: "confirmed",
        })
        .eq("id", booking.id);
      if (error) throw error;

      setBooking({
        ...booking,
        starts_at: newStart.toISOString(),
        ends_at: newEnd.toISOString(),
        meet_link: meetLink,
        status: "confirmed",
      });
      setRescheduleOpen(false);
      toast.success("Meeting rescheduled");

      supabase.functions.invoke("send-booking-emails", {
        body: { bookingId: booking.id, kind: "rescheduled" },
      }).catch(() => {});
    } catch (e: any) {
      toast.error(e.message || "Could not reschedule");
    } finally {
      setBusy(false);
    }
  }

  if (!booking) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center text-sm text-muted-foreground">
        Loading meeting…
      </div>
    );
  }

  const start = new Date(booking.starts_at);
  const end = new Date(booking.ends_at);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <SafeIcon icon={ArrowLeftIcon} className="h-3.5 w-3.5" /> Back
      </button>

      <div className="panel p-6">
        <div className="flex items-start justify-between gap-4 border-b border-border pb-5">
          <div>
            <h1 className="text-xl font-semibold">Quick chat with {booking.visitor_name}</h1>
            <p className="mt-1 text-xs text-muted-foreground">Booking #{booking.id.slice(0, 8)}</p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
              booking.status === "confirmed"
                ? "bg-emerald-500/15 text-emerald-400"
                : booking.status === "cancelled"
                  ? "bg-destructive/15 text-destructive"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {booking.status}
          </span>
        </div>

        <dl className="mt-5 space-y-4 text-sm">
          <Row icon={CalendarDaysIcon} term="Date">
            {format(start, "EEEE, MMMM d, yyyy")}
          </Row>
          <Row icon={ClockIcon} term="Time">
            {format(start, "h:mm a")} – {format(end, "h:mm a")}
            <span className="ml-2 text-xs text-muted-foreground">({booking.duration_minutes} min)</span>
          </Row>
          <Row icon={UserIcon} term="Visitor">
            <button
              onClick={() => setDrawerOpen(true)}
              className="inline-flex items-center gap-1 text-foreground hover:text-accent"
            >
              {booking.visitor_name}
              <IdentificationIcon className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </Row>
          <Row icon={EnvelopeIcon} term="Email">
            <a href={`mailto:${booking.visitor_email}`} className="text-accent hover:underline">
              {booking.visitor_email}
            </a>
          </Row>
          {booking.meet_link && (
            <Row icon={VideoCameraIcon} term="Meet link">
              <a href={booking.meet_link} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                {booking.meet_link}
              </a>
            </Row>
          )}
          {booking.notes && (
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</div>
              <p className="rounded-lg border border-border bg-surface-elevated p-3 text-sm">{booking.notes}</p>
            </div>
          )}
        </dl>

        {rescheduleOpen && (
          <div className="mt-5 rounded-xl border border-accent/40 bg-accent/5 p-4">
            <div className="mb-3 text-sm font-semibold">Reschedule meeting</div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="block">
                <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">Date</div>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="rounded-md border border-border bg-surface-elevated px-3 py-1.5 text-sm text-foreground"
                />
              </label>
              <label className="block">
                <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">Time</div>
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="rounded-md border border-border bg-surface-elevated px-3 py-1.5 text-sm text-foreground"
                />
              </label>
              <button
                onClick={reschedule}
                disabled={busy}
                className="rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save & notify"}
              </button>
              <button
                onClick={() => setRescheduleOpen(false)}
                className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-5">
          {booking.meet_link && booking.status === "confirmed" && (
            <a
              href={booking.meet_link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90"
            >
              <SafeIcon icon={VideoCameraIcon} className="h-4 w-4" /> Join Meet
            </a>
          )}
          {booking.status === "confirmed" && !rescheduleOpen && (
            <button
              onClick={() => setRescheduleOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-elevated px-4 py-2 text-sm hover:bg-surface-hover"
            >
              <SafeIcon icon={ArrowPathIcon} className="h-4 w-4" /> Reschedule
            </button>
          )}
          <a
            href={`mailto:${booking.visitor_email}?subject=Re: our quick chat`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-elevated px-4 py-2 text-sm hover:bg-surface-hover"
          >
            <SafeIcon icon={EnvelopeIcon} className="h-4 w-4" /> Email visitor
          </a>
          {booking.status === "confirmed" && (
            <button
              onClick={cancel}
              disabled={busy}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              <SafeIcon icon={XCircleIcon} className="h-4 w-4" /> Cancel meeting
            </button>
          )}
        </div>

        <Link
          to="/admin/notifications"
          className="mt-6 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <SafeIcon icon={CheckCircleIcon} className="h-3.5 w-3.5" />
          Notification marked as read
        </Link>
      </div>

      <VisitorDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        visitorEmail={booking.visitor_email}
        visitorName={booking.visitor_name}
      />
    </div>
  );
}

function Row({
  icon,
  term,
  children,
}: {
  icon: any;
  term: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <SafeIcon icon={icon} className="mt-0.5 h-4 w-4 text-accent" />
      <div className="flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{term}</div>
        <div className="text-foreground">{children}</div>
      </div>
    </div>
  );
}
