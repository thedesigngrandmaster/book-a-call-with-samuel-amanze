// Sends booking confirmation / reschedule / cancellation emails to the visitor and admin.
// Renders branded HTML inline (Samuel AMANZE's Calendar styling, blue accents, photo avatar)
// and forwards to the in-project send-transactional-email function if available.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ADMIN_EMAIL = 'officialsammy61@gmail.com';
const HOST_NAME = 'Samuel AMANZE';
const SENDER_NAME = "Samuel AMANZE's Calendar";
const BRAND_BLUE = '#2563eb';
const PROFILE_PHOTO_URL =
  'https://id-preview--c663fa3c-7d24-41ab-84ad-a27e901462e5.lovable.app/me.jpg';

interface Body {
  bookingId: string;
  kind: 'confirmed' | 'rescheduled' | 'cancelled';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return json({ error: 'Unauthorized' }, 401);

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
      confirmed: `Your Quick chat with ${HOST_NAME} is confirmed`,
      rescheduled: `Your Quick chat with ${HOST_NAME} has been rescheduled`,
      cancelled: `Your Quick chat with ${HOST_NAME} was cancelled`,
    } as const;

    const headlineMap = {
      confirmed: 'Your meeting is confirmed 🎉',
      rescheduled: 'Your meeting has been rescheduled',
      cancelled: 'Your meeting has been cancelled',
    } as const;

    const introMap = {
      confirmed: `Hi {NAME}, your Quick chat with ${HOST_NAME} is locked in. Details below — looking forward to it!`,
      rescheduled: `Hi {NAME}, your Quick chat with ${HOST_NAME} has been moved. The new details are below and a fresh Google Meet link is included.`,
      cancelled: `Hi {NAME}, your Quick chat with ${HOST_NAME} has been cancelled. You can book a new time anytime.`,
    } as const;

    function renderHtml(role: 'visitor' | 'admin') {
      const greetName = role === 'admin' ? HOST_NAME.split(' ')[0] : booking.visitor_name;
      const intro = introMap[kind].replace('{NAME}', escapeHtml(greetName));

      const meetBlock = booking.meet_link && kind !== 'cancelled'
        ? `
          <tr><td style="padding:24px 0 8px 0;">
            <a href="${escapeAttr(booking.meet_link)}"
               style="display:inline-block;background:${BRAND_BLUE};color:#ffffff;text-decoration:none;
                      padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px;">
              Join Google Meet
            </a>
          </td></tr>`
        : '';

      const noteBlock = booking.notes
        ? `<tr><td style="padding-top:8px;color:#475569;font-size:13px;line-height:1.55;">
              <strong style="color:#0f172a;">Notes from visitor:</strong><br/>
              ${escapeHtml(booking.notes).replace(/\n/g, '<br/>')}
           </td></tr>`
        : '';

      const adminContext = role === 'admin'
        ? `<tr><td style="padding-top:8px;color:#64748b;font-size:12px;line-height:1.55;">
              <strong>Visitor:</strong> ${escapeHtml(booking.visitor_name)}
              &nbsp;•&nbsp; <a href="mailto:${escapeAttr(booking.visitor_email)}" style="color:${BRAND_BLUE};text-decoration:none;">${escapeHtml(booking.visitor_email)}</a>
           </td></tr>`
        : '';

      return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(subjectMap[kind])}</title>
  </head>
  <body style="margin:0;padding:0;background:#eaf1ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eaf1ff;padding:32px 12px;">
      <tr><td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
               style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;
                      box-shadow:0 1px 3px rgba(15,23,42,0.06);overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="padding:22px 28px;border-bottom:1px solid #eef2f7;">
              <table role="presentation" width="100%"><tr>
                <td style="vertical-align:middle;">
                  <img src="${PROFILE_PHOTO_URL}" alt="${escapeAttr(HOST_NAME)}"
                       width="36" height="36"
                       style="display:inline-block;vertical-align:middle;border-radius:50%;
                              border:2px solid ${BRAND_BLUE};object-fit:cover;" />
                  <span style="display:inline-block;vertical-align:middle;margin-left:10px;
                               font-size:15px;font-weight:600;color:#0f172a;">
                    ${escapeHtml(SENDER_NAME)}
                  </span>
                </td>
              </tr></table>
            </td>
          </tr>

          <!-- Body -->
          <tr><td style="padding:28px 28px 8px 28px;">
            <h1 style="margin:0 0 6px 0;font-size:20px;font-weight:700;color:#0f172a;">
              ${escapeHtml(headlineMap[kind])}
            </h1>
            <p style="margin:0 0 18px 0;font-size:14px;line-height:1.6;color:#334155;">${intro}</p>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                   style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 18px;">
              <tr><td style="font-size:13px;color:#64748b;padding-bottom:4px;">When</td></tr>
              <tr><td style="font-size:14px;color:#0f172a;font-weight:600;padding-bottom:14px;">
                ${escapeHtml(fmt(start))}<br/>
                <span style="font-weight:400;color:#475569;">to ${escapeHtml(fmt(end))}</span>
              </td></tr>
              <tr><td style="font-size:13px;color:#64748b;padding-bottom:4px;">Duration</td></tr>
              <tr><td style="font-size:14px;color:#0f172a;font-weight:600;padding-bottom:14px;">
                ${booking.duration_minutes} minutes
              </td></tr>
              <tr><td style="font-size:13px;color:#64748b;padding-bottom:4px;">Where</td></tr>
              <tr><td style="font-size:14px;color:#0f172a;font-weight:600;">
                ${booking.meet_link
                  ? `<a href="${escapeAttr(booking.meet_link)}" style="color:${BRAND_BLUE};text-decoration:none;">Google Meet ↗</a>`
                  : 'A Google Meet link will be sent shortly.'}
              </td></tr>
              ${noteBlock}
              ${adminContext}
            </table>

            <table role="presentation" width="100%">${meetBlock}</table>
          </td></tr>

          <!-- Footer -->
          <tr><td style="padding:22px 28px 26px 28px;border-top:1px solid #eef2f7;">
            <p style="margin:0 0 6px 0;font-size:12px;color:#64748b;">
              Need to reach ${HOST_NAME.split(' ')[0]}? Reply to this email or write to
              <a href="mailto:${ADMIN_EMAIL}" style="color:${BRAND_BLUE};text-decoration:none;">${ADMIN_EMAIL}</a>.
            </p>
            <p style="margin:14px 0 0 0;font-size:11px;color:#94a3b8;text-align:center;">
              © 2026, ${HOST_NAME}'s calendar • All rights reserved
            </p>
          </td></tr>

        </table>
      </td></tr>
    </table>
  </body>
</html>`;
    }

    const sendOne = async (to: string, role: 'visitor' | 'admin') => {
      const html = renderHtml(role);
      try {
        const { error: sErr } = await supa.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'booking-update',
            recipientEmail: to,
            idempotencyKey: `booking-${kind}-${bookingId}-${role}`,
            templateData: {
              kind,
              role,
              subject: subjectMap[kind],
              senderName: SENDER_NAME,
              hostName: HOST_NAME,
              visitorName: booking.visitor_name,
              visitorEmail: booking.visitor_email,
              startsAt: fmt(start),
              endsAt: fmt(end),
              durationMinutes: booking.duration_minutes,
              meetLink: booking.meet_link,
              notes: booking.notes,
              bodyHtml: html,
            },
          },
        });
        if (sErr) console.warn(`send-transactional-email error for ${to}`, sErr);
      } catch (e) {
        console.warn('Email send infra not set up — preview HTML logged for', to, e);
        console.log(`---- ${role} email preview (${to}) ----\n${html}`);
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

function escapeHtml(s: string | null | undefined): string {
  if (!s) return '';
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
function escapeAttr(s: string | null | undefined): string {
  return escapeHtml(s);
}
