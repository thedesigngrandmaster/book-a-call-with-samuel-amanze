// Sends booking confirmation / reschedule / cancellation emails to the visitor and admin.
// Uses the in-project send-transactional-email function if available; falls back to console log.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ADMIN_EMAIL = 'officialsammy61@gmail.com';

interface Body {
  bookingId: string;
  kind: 'confirmed' | 'rescheduled' | 'cancelled';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const auth = req.headers.get('Authorization');
    if (!auth) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const supa = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { bookingId, kind } = (await req.json()) as Body;
    if (!bookingId || !kind) return json({ error: 'Missing fields' }, 400);

    const { data: booking, error } = await supa
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .maybeSingle();
    if (error || !booking) return json({ error: 'Booking not found' }, 404);

    const start = new Date(booking.starts_at);
    const end = new Date(booking.ends_at);
    const fmt = (d: Date) => d.toLocaleString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    });

    const subjectMap = {
      confirmed: `Your Quick chat with Samuel AMANZE is confirmed`,
      rescheduled: `Your Quick chat with Samuel AMANZE has been rescheduled`,
      cancelled: `Your Quick chat with Samuel AMANZE was cancelled`,
    };

    const sendOne = async (to: string, role: 'visitor' | 'admin') => {
      try {
        const { error: sErr } = await supa.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'booking-update',
            recipientEmail: to,
            idempotencyKey: `booking-${kind}-${bookingId}-${role}`,
            templateData: {
              kind,
              visitorName: booking.visitor_name,
              visitorEmail: booking.visitor_email,
              startsAt: fmt(start),
              endsAt: fmt(end),
              durationMinutes: booking.duration_minutes,
              meetLink: booking.meet_link,
              notes: booking.notes,
              role,
              subject: subjectMap[kind],
            },
          },
        });
        if (sErr) console.warn(`send-transactional-email error for ${to}`, sErr);
      } catch (e) {
        console.warn('Email send error (infra not set up?)', to, e);
      }
    };

    await Promise.all([sendOne(booking.visitor_email, 'visitor'), sendOne(ADMIN_EMAIL, 'admin')]);

    return json({ ok: true });
  } catch (err) {
    console.error('send-booking-emails error', err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
