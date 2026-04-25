import { useEffect, useMemo, useState } from "react";
import { addMinutes, format, isBefore, isSameDay, startOfDay, startOfMonth, addMonths, isAfter, endOfMonth } from "date-fns";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  GlobeAltIcon,
  VideoCameraIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { z } from "zod";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const HOST_NAME = "Samuel AMANZE";
const HOST_TITLE = "Quick chat";
const HOST_KIND = "Video Chat";
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

// Earliest selectable month per user request
const MIN_MONTH = startOfMonth(new Date(2026, 3, 1)); // April 2026

// Working hours 9:00 → 17:00, 30-minute slots
const WORK_START_HOUR = 9;
const WORK_END_HOUR = 17;

const DURATIONS = [15, 20, 30, 45, 60] as const;
type Duration = (typeof DURATIONS)[number];

const formSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.string().trim().email("Enter a valid email").max(160),
  notes: z.string().trim().max(500).optional(),
});

type Step = "pick" | "form" | "done";

export default function BookingPage() {
  const { user, signInWithMagicLink } = useAuth();

  const [duration, setDuration] = useState<Duration>(30);
  const [viewMonth, setViewMonth] = useState(MIN_MONTH);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [hour12, setHour12] = useState(true);
  const [taken, setTaken] = useState<Date[]>([]);
  const [step, setStep] = useState<Step>("pick");

  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<{
    id: string;
    starts_at: string;
    ends_at: string;
    meet_link: string | null;
    visitor_name: string;
    visitor_email: string;
  } | null>(null);

  // Load taken slots for the visible month
  useEffect(() => {
    let active = true;
    (async () => {
      const from = startOfMonth(viewMonth).toISOString();
      const to = endOfMonth(viewMonth).toISOString();
      const { data } = await supabase.rpc("taken_slots", { _from: from, _to: to });
      if (active && data) setTaken(data.map((d: any) => new Date(d.starts_at)));
    })();
    return () => {
      active = false;
    };
  }, [viewMonth, step]);

  // Days for grid (calendar view of viewMonth)
  const days = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);

  const slots = useMemo(() => {
    if (!selectedDate) return [];
    const out: Date[] = [];
    const day = startOfDay(selectedDate);
    let cur = new Date(day);
    cur.setHours(WORK_START_HOUR, 0, 0, 0);
    const end = new Date(day);
    end.setHours(WORK_END_HOUR, 0, 0, 0);
    while (isBefore(cur, end)) {
      out.push(new Date(cur));
      cur = addMinutes(cur, duration);
    }
    return out;
  }, [selectedDate, duration]);

  function isSlotTaken(slot: Date) {
    return taken.some((t) => Math.abs(t.getTime() - slot.getTime()) < 60_000);
  }

  function canGoPrev() {
    return isAfter(viewMonth, MIN_MONTH);
  }

  async function handleConfirm() {
    const parsed = formSchema.safeParse({ name: formName, email: formEmail, notes: formNotes });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (!selectedSlot) return;

    setSubmitting(true);
    try {
      // Visitor must be authenticated to insert (RLS)
      if (!user) {
        const { error } = await signInWithMagicLink(parsed.data.email, parsed.data.name);
        if (error) throw new Error(error);
        setMagicSent(true);
        return;
      }

      const ends = addMinutes(selectedSlot, duration);
      const { data, error } = await supabase
        .from("bookings")
        .insert({
          visitor_id: user.id,
          visitor_name: parsed.data.name,
          visitor_email: parsed.data.email,
          starts_at: selectedSlot.toISOString(),
          ends_at: ends.toISOString(),
          duration_minutes: duration,
          notes: parsed.data.notes || null,
          // Placeholder Meet link (real one will be generated once Google OAuth is wired)
          meet_link: `https://meet.google.com/lookup/${Math.random().toString(36).slice(2, 11)}`,
          status: "confirmed",
        })
        .select()
        .single();
      if (error) throw error;
      setConfirmedBooking(data as any);
      setStep("done");
    } catch (e: any) {
      toast.error(e.message || "Could not book the meeting");
    } finally {
      setSubmitting(false);
    }
  }

  // ===================== RENDER =====================
  if (step === "done" && confirmedBooking) {
    return <ConfirmationView b={confirmedBooking} onReset={resetAll} />;
  }

  function resetAll() {
    setSelectedDate(null);
    setSelectedSlot(null);
    setStep("pick");
    setFormName("");
    setFormEmail("");
    setFormNotes("");
    setConfirmedBooking(null);
  }

  if (step === "form" && selectedSlot) {
    if (magicSent) {
      return (
        <CenterCard>
          <CheckCircleIcon className="mx-auto mb-4 h-12 w-12 text-accent" />
          <h2 className="text-xl font-semibold">Check your inbox</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a sign-in link to <span className="text-foreground">{formEmail}</span>. Click it to confirm your booking — your slot is held.
          </p>
        </CenterCard>
      );
    }

    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="panel grid gap-0 md:grid-cols-[1fr_1.4fr]">
          <aside className="border-b border-border p-6 md:border-b-0 md:border-r">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">SA</span>
              <span className="text-sm text-muted-foreground">{HOST_NAME}</span>
            </div>
            <h1 className="text-2xl font-semibold">{HOST_TITLE}</h1>
            <p className="text-sm text-muted-foreground">{HOST_KIND}</p>

            <ul className="mt-6 space-y-3 text-sm">
              <li className="flex items-center gap-2 text-muted-foreground">
                <CalendarIconInline />
                <span>
                  {format(selectedSlot, "EEEE, MMMM d, yyyy")}
                  <br />
                  {format(selectedSlot, hour12 ? "h:mm a" : "HH:mm")}
                  {" – "}
                  {format(addMinutes(selectedSlot, duration), hour12 ? "h:mm a" : "HH:mm")}
                </span>
              </li>
              <li className="flex items-center gap-2 text-muted-foreground">
                <ClockIcon className="h-4 w-4" /> {duration}m
              </li>
              <li className="flex items-center gap-2 text-muted-foreground">
                <VideoCameraIcon className="h-4 w-4 text-accent" /> Google Meet
              </li>
              <li className="flex items-center gap-2 text-muted-foreground">
                <GlobeAltIcon className="h-4 w-4" /> {TZ}
              </li>
            </ul>
          </aside>

          <div className="p-6">
            <div className="space-y-4">
              <Field label="Your name *">
                <input value={formName} onChange={(e) => setFormName(e.target.value)} className="input" maxLength={80} required />
              </Field>
              <Field label="Email address *">
                <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} className="input" maxLength={160} required />
              </Field>
              <Field label="Additional notes">
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Please share anything that will help prepare for our meeting."
                  className="input min-h-[110px] resize-y"
                  maxLength={500}
                />
              </Field>

              <p className="pt-2 text-xs text-muted-foreground">
                By proceeding, you agree to receive a calendar invite at the email above.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button onClick={() => setStep("pick")} className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
                  Back
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={submitting}
                  className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? "Booking…" : user ? "Confirm" : "Confirm & verify email"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // STEP: pick date / time
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="panel grid gap-0 md:grid-cols-[280px_1fr_240px]">
        {/* Left: host card */}
        <aside className="border-b border-border p-6 md:border-b-0 md:border-r">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">SA</span>
            <span className="text-sm text-muted-foreground">{HOST_NAME}</span>
          </div>
          <h1 className="text-2xl font-semibold leading-tight">{HOST_TITLE}</h1>
          <p className="text-sm text-muted-foreground">{HOST_KIND}</p>

          <div className="mt-6 space-y-4 text-sm">
            <div className="flex items-center gap-3">
              <ClockIcon className="h-4 w-4 text-muted-foreground" />
              <div className="flex overflow-hidden rounded-md border border-border bg-surface-elevated">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    className={`px-3 py-1.5 text-xs font-medium transition ${
                      duration === d ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {d}m
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <VideoCameraIcon className="h-4 w-4 text-accent" /> Google Meet
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <GlobeAltIcon className="h-4 w-4" /> {TZ}
            </div>
          </div>
        </aside>

        {/* Center: calendar */}
        <section className="border-b border-border p-6 md:border-b-0 md:border-r">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {format(viewMonth, "MMMM")} <span className="text-muted-foreground">{format(viewMonth, "yyyy")}</span>
            </h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => canGoPrev() && setViewMonth(addMonths(viewMonth, -1))}
                disabled={!canGoPrev()}
                className="rounded-md p-1.5 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Previous month"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMonth(addMonths(viewMonth, 1))}
                className="rounded-md p-1.5 hover:bg-secondary"
                aria-label="Next month"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mb-2 grid grid-cols-7 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {days.map((d, i) => {
              const inMonth = d.getMonth() === viewMonth.getMonth();
              const past = isBefore(d, startOfDay(new Date())) || isBefore(d, MIN_MONTH);
              const isSel = selectedDate && isSameDay(d, selectedDate);
              const today = isSameDay(d, new Date());
              return (
                <button
                  key={i}
                  disabled={past}
                  onClick={() => {
                    setSelectedDate(d);
                    setSelectedSlot(null);
                  }}
                  className={[
                    "aspect-square rounded-lg text-sm transition",
                    past ? "cursor-not-allowed text-muted-foreground/30" : "hover:bg-secondary",
                    inMonth && !past ? "bg-surface-elevated text-foreground" : "",
                    isSel ? "bg-foreground text-background" : "",
                    today && !isSel ? "ring-1 ring-accent" : "",
                  ].join(" ")}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </section>

        {/* Right: time slots */}
        <section className="p-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-medium">
              {selectedDate ? format(selectedDate, "EEE d") : "Pick a date"}
            </div>
            <div className="flex overflow-hidden rounded-md border border-border bg-surface-elevated text-xs">
              <button onClick={() => setHour12(true)} className={`px-2 py-1 ${hour12 ? "bg-secondary text-foreground" : "text-muted-foreground"}`}>12h</button>
              <button onClick={() => setHour12(false)} className={`px-2 py-1 ${!hour12 ? "bg-secondary text-foreground" : "text-muted-foreground"}`}>24h</button>
            </div>
          </div>

          {!selectedDate ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              Select a date to see available times.
            </div>
          ) : (
            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {slots.map((s) => {
                const taken = isSlotTaken(s);
                const past = isBefore(s, new Date());
                const disabled = taken || past;
                return (
                  <button
                    key={s.toISOString()}
                    disabled={disabled}
                    onClick={() => {
                      setSelectedSlot(s);
                      setStep("form");
                    }}
                    className={`slot-btn ${disabled ? "cursor-not-allowed opacity-30 line-through" : ""}`}
                  >
                    {format(s, hour12 ? "h:mma" : "HH:mm").toLowerCase()}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Samuel AMANZE's Calendar · for friends & family
      </p>
    </div>
  );
}

function buildMonthGrid(month: Date): Date[] {
  const first = startOfMonth(month);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay()); // back to Sunday
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-semibold text-foreground">{label}</div>
      {children}
    </label>
  );
}

function CalendarIconInline() {
  return (
    <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  );
}

function CenterCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <div className="panel p-8">{children}</div>
    </div>
  );
}

function ConfirmationView({
  b,
  onReset,
}: {
  b: { id: string; starts_at: string; ends_at: string; meet_link: string | null; visitor_name: string; visitor_email: string };
  onReset: () => void;
}) {
  const start = new Date(b.starts_at);
  const end = new Date(b.ends_at);
  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="panel p-8">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
            <CheckCircleIcon className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-xl font-semibold">This meeting is scheduled</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            We saved a calendar invite. Details are below.
          </p>
        </div>

        <dl className="mt-6 space-y-4 border-t border-border pt-6 text-sm">
          <Row term="What" desc={`${HOST_TITLE} between ${HOST_NAME} and ${b.visitor_name}`} />
          <Row term="When" desc={`${format(start, "EEEE, MMMM d, yyyy")}\n${format(start, "h:mm a")} – ${format(end, "h:mm a")} (${TZ})`} />
          <Row
            term="Who"
            desc={
              <>
                <div>
                  {HOST_NAME} <span className="ml-1 rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-bold text-accent">Host</span>
                </div>
                <div className="text-muted-foreground">officialsammy61@gmail.com</div>
                <div className="mt-2">{b.visitor_name}</div>
                <div className="text-muted-foreground">{b.visitor_email}</div>
              </>
            }
          />
          <Row
            term="Where"
            desc={
              b.meet_link ? (
                <a href={b.meet_link} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                  Google Meet ↗
                </a>
              ) : (
                <span className="text-muted-foreground">Will be added shortly</span>
              )
            }
          />
        </dl>

        <div className="mt-6 flex justify-center gap-3 border-t border-border pt-6">
          <Link to="/account" className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-hover">
            View my bookings
          </Link>
          <button onClick={onReset} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-hover">
            Book another
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ term, desc }: { term: string; desc: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[80px_1fr] gap-4">
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="whitespace-pre-line text-foreground">{desc}</dd>
    </div>
  );
}
