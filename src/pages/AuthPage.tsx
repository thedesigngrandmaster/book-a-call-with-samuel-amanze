import { useState } from "react";
import { CalendarDaysIcon, EnvelopeIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

export default function AuthPage() {
  const { user, loading, signInWithMagicLink } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = z.string().trim().email().safeParse(email);
    if (!parsed.success) {
      toast.error("Enter a valid email");
      return;
    }
    setBusy(true);
    const { error } = await signInWithMagicLink(parsed.data);
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    setSent(true);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-20">
      <div className="panel p-8">
        <div className="mb-6 flex items-center gap-2">
          <CalendarDaysIcon className="h-7 w-7 text-accent" />
          <span className="text-base font-semibold">Samuel AMANZE's Calendar</span>
        </div>

        {sent ? (
          <div className="text-center">
            <EnvelopeIcon className="mx-auto h-10 w-10 text-accent" />
            <h1 className="mt-3 text-lg font-semibold">Check your inbox</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We emailed a magic sign-in link to <span className="text-foreground">{email}</span>.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <h1 className="text-lg font-semibold">Sign in</h1>
            <p className="text-sm text-muted-foreground">No password needed. We email you a one-click sign-in link.</p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="input"
              required
            />
            <button disabled={busy} className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-accent-foreground shadow-[0_8px_30px_-8px_hsl(var(--accent)/0.6)] transition hover:opacity-90 disabled:opacity-50">
              {busy ? "Sending…" : "Send magic link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
