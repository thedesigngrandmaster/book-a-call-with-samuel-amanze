// Creates a Google Calendar event with a Google Meet link on the host's calendar.
// Returns the Meet link + event id. The booking row in DB is updated by the client.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/google_calendar/calendar/v3';

interface Body {
  bookingId: string;
  summary: string;
  description?: string;
  startsAt: string; // ISO
  endsAt: string;   // ISO
  visitorEmail: string;
  visitorName: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const GOOGLE_CALENDAR_API_KEY = Deno.env.get('GOOGLE_CALENDAR_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');
    if (!GOOGLE_CALENDAR_API_KEY) throw new Error('GOOGLE_CALENDAR_API_KEY not configured');

    const body = (await req.json()) as Body;
    if (!body.bookingId || !body.startsAt || !body.endsAt || !body.visitorEmail) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Auth: verify caller via JWT
    const auth = req.headers.get('Authorization');
    if (!auth) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supa = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await supa.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create the event on the host's primary calendar with a Meet link.
    const requestId = crypto.randomUUID();
    const eventBody = {
      summary: body.summary,
      description: body.description ?? '',
      start: { dateTime: body.startsAt },
      end: { dateTime: body.endsAt },
      attendees: [{ email: body.visitorEmail, displayName: body.visitorName }],
      conferenceData: {
        createRequest: {
          requestId,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
      reminders: { useDefault: true },
    };

    const url = `${GATEWAY_URL}/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': GOOGLE_CALENDAR_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventBody),
    });
    const data = await resp.json();
    if (!resp.ok) {
      console.error('Google Calendar API error', resp.status, data);
      return new Response(JSON.stringify({ error: `Google API ${resp.status}`, details: data }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const meetLink: string | null =
      data?.hangoutLink ||
      data?.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === 'video')?.uri ||
      null;

    return new Response(JSON.stringify({
      eventId: data.id,
      meetLink,
      htmlLink: data.htmlLink,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('create-meet-event error', err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
