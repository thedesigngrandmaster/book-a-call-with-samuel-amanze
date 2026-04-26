import { useEffect, useState } from "react";
import { useParams, Navigate, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  ClockIcon,
  EnvelopeIcon,
  UserIcon,
  VideoCameraIcon,
  XCircleIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";
import SafeIcon from "@/components/SafeIcon";

export default function BookingDetailPage() {
  const { id } = useParams();
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id || role !== "admin") return;
    supabase
      .from("bookings")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => setBooking(data));

    // Mark related notifications as read
    supabase
      .from("notifications")
      .update({ read: true })
      .eq("booking_id", id)
      .eq("recipient_id", user!.id)
      .then(() => {});
  }, [id, role, user]);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (role !== "admin") return <Navigate to="/" replace />;

  async function cancel() {
    if (!booking) return;
    if (!confirm("Cancel this meeting? The visitor will keep their record but it will be marked cancelled.")) return;
    setBusy(true);
    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", booking.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Meeting cancelled");
    setBooking({ ...booking, status: "cancelled" });
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
            {booking.visitor_name}
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
          Marked notification as read
        </Link>
      </div>
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
