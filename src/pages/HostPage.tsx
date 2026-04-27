import { Link } from "react-router-dom";
import { ClockIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

const DURATIONS = [15, 20, 30, 60, 90];

export default function HostPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      {/* Profile card */}
      <div className="panel p-6">
        <img
          src="/me.jpg"
          alt="Samuel AMANZE"
          className="h-16 w-16 rounded-full object-cover ring-2 ring-accent/40"
        />
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Samuel AMANZE</h1>
      </div>

      {/* Quick chat card -> goes to booking */}
      <Link
        to="/"
        className="panel mt-4 block p-6 transition hover:bg-surface-hover"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Quick chat</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Video Chat</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {DURATIONS.map((d) => (
                <span
                  key={d}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-elevated px-2 py-1 text-xs text-muted-foreground"
                >
                  <ClockIcon className="h-3 w-3" /> {d}m
                </span>
              ))}
            </div>
          </div>
          <ChevronRightIcon className="mt-1 h-5 w-5 text-muted-foreground" />
        </div>
      </Link>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        © 2026, Samuel AMANZE's calendar • All rights reserved
      </p>
    </div>
  );
}
