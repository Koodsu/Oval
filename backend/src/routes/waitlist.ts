import { Router, Request, Response } from 'express';
import { Resend } from 'resend';
import { asyncHandler } from '../lib/asyncHandler';
import { consumeDurableRateLimit } from '../lib/durableRateLimit';

const router = Router();
const WAITLIST_SEGMENT_ID = process.env.RESEND_WAITLIST_SEGMENT_ID?.trim() || undefined;
const CONTACT_EMAIL = process.env.CONTACT_EMAIL?.trim() || 'contactus@theovalapp.com';
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL?.trim() || 'noreply@theovalapp.com';

const OSU_EMAIL_RE = /@(osu\.edu|buckeyemail\.osu\.edu)$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function limited(value: unknown, max: number): string {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max)
    : '';
}

function requestIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  return apiKey ? new Resend(apiKey) : null;
}

async function getWaitlistCount(): Promise<number> {
  const resend = getResendClient();
  if (!resend) {
    throw new Error('Waitlist counter is unavailable');
  }

  let total = 0;
  let after: string | undefined;

  for (;;) {
    const result = await resend.contacts.list({
      limit: 100,
      ...(WAITLIST_SEGMENT_ID ? { segmentId: WAITLIST_SEGMENT_ID } : {}),
      ...(after ? { after } : {}),
    });

    if (result.error || !result.data) {
      throw new Error(result.error?.message || 'Could not fetch waitlist count from Resend');
    }

    total += result.data.data.length;

    if (!result.data.has_more || result.data.data.length === 0) {
      return total;
    }

    after = result.data.data[result.data.data.length - 1]?.id;
    if (!after) return total;
  }
}

// GET /waitlist/count — current number of waitlist signups
router.get('/count', asyncHandler(async (_req: Request, res: Response) => {
  if (!process.env.RESEND_API_KEY) {
    res.status(503).json({ error: 'Waitlist counter is unavailable' });
    return;
  }

  const count = await getWaitlistCount();
  res.json({ count });
}));

// POST /waitlist — add an email to the Resend contact list
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body as { email?: unknown };

  const resend = getResendClient();
  if (!resend) {
    res.status(503).json({ error: 'Waitlist signup is temporarily unavailable' });
    return;
  }

  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(normalizedEmail) || normalizedEmail.length > 254) {
    res.status(400).json({ error: 'A valid email is required' });
    return;
  }

  const allowed = await consumeDurableRateLimit({
    action: 'waitlist_signup',
    identifiers: [normalizedEmail, requestIp(req)],
    limit: 10,
    windowMs: 24 * 60 * 60 * 1000,
  });
  if (!allowed) {
    res.status(429).json({ error: 'Too many signup attempts. Try again later.' });
    return;
  }

  const result = await resend.contacts.create({
    email: normalizedEmail,
    unsubscribed: false,
    ...(WAITLIST_SEGMENT_ID ? { segments: [{ id: WAITLIST_SEGMENT_ID }] } : {}),
  });
  if (result.error) {
    throw new Error(`Resend waitlist error: ${result.error.message}`);
  }

  res.status(201).json({ success: true });
}));

// POST /waitlist/club-registration — register a club leader
router.post('/club-registration', asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;

  const resend = getResendClient();
  if (!resend) {
    res.status(503).json({ error: 'Club registration is temporarily unavailable' });
    return;
  }

  const clubName = limited(body.clubName, 120);
  const yourName = limited(body.yourName, 100);
  const role = limited(body.role, 100);
  const email = limited(body.email, 254).toLowerCase();
  const category = limited(body.category, 80);
  const description = limited(body.description, 1500);
  const instagramOrWebsite = limited(body.instagramOrWebsite, 300);
  const biggestChallenge = limited(body.biggestChallenge, 1000);

  if (!clubName) { res.status(400).json({ error: 'Club name is required' }); return; }
  if (!yourName) { res.status(400).json({ error: 'Your name is required' }); return; }
  if (!role) { res.status(400).json({ error: 'Your role is required' }); return; }
  if (!email) { res.status(400).json({ error: 'Email is required' }); return; }
  if (!OSU_EMAIL_RE.test(email)) {
    res.status(400).json({ error: 'Must be an @osu.edu or @buckeyemail.osu.edu address' });
    return;
  }
  if (!category) { res.status(400).json({ error: 'Club category is required' }); return; }
  if (!description) { res.status(400).json({ error: 'Club description is required' }); return; }

  const allowed = await consumeDurableRateLimit({
    action: 'club_registration',
    identifiers: [email, requestIp(req)],
    limit: 5,
    windowMs: 24 * 60 * 60 * 1000,
  });
  if (!allowed) {
    res.status(429).json({ error: 'Too many registration attempts. Try again later.' });
    return;
  }

  const safe = {
    clubName: escapeHtml(clubName),
    yourName: escapeHtml(yourName),
    role: escapeHtml(role),
    email: escapeHtml(email),
    category: escapeHtml(category),
    description: escapeHtml(description),
    instagramOrWebsite: escapeHtml(instagramOrWebsite || 'Not provided'),
    biggestChallenge: escapeHtml(biggestChallenge || 'Not provided'),
  };

  // Confirmation email to the registrant
  const confirmResult = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Your club registration was received by Oval',
    html: `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #F5EFE4; padding: 0;">
        <div style="background: #0D0D0B; padding: 24px 32px; display: flex; align-items: center; gap: 12px;">
          <div style="width: 28px; height: 28px; background: #BB0000; display: inline-flex; align-items: center; justify-content: center;">
            <span style="color: white; font-size: 16px; font-weight: 900; font-family: Impact, sans-serif;">B</span>
          </div>
          <span style="color: white; font-size: 22px; font-weight: 900; letter-spacing: 0.12em; font-family: Impact, 'Arial Narrow', sans-serif;">OVAL</span>
        </div>
        <div style="padding: 40px 32px;">
          <h1 style="margin: 0 0 8px; font-size: 28px; font-weight: 900; letter-spacing: 0.05em; color: #0D0D0B; font-family: Impact, 'Arial Narrow', sans-serif; text-transform: uppercase;">
            ${safe.clubName} is registered.
          </h1>
          <p style="margin: 0 0 24px; font-size: 16px; color: #666666; line-height: 1.6;">
            Hey ${safe.yourName} - thanks for registering <strong>${safe.clubName}</strong> with Oval. We will use this information to prepare club onboarding and launch updates.
          </p>
          <div style="background: white; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <p style="margin: 0 0 6px; font-size: 12px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: #BB0000;">What's next</p>
            <p style="margin: 0; font-size: 15px; color: #444444; line-height: 1.6;">
              We will reach out to your OSU email before launch to confirm details and help set up your club. Keep an eye on <strong>${safe.email}</strong>.
            </p>
          </div>
          <p style="margin: 0; font-size: 14px; color: #999999; line-height: 1.6;">
            Questions? Reply to this email or reach us at ${escapeHtml(CONTACT_EMAIL)}
          </p>
        </div>
        <div style="background: #0D0D0B; padding: 20px 32px; text-align: center;">
          <p style="margin: 0; font-size: 12px; color: rgba(255,255,255,0.35);">&copy; 2026 Oval. Independent and not affiliated with The Ohio State University.</p>
        </div>
      </div>
    `,
  });

  if (confirmResult.error) {
    console.warn('[waitlist/club-registration] Confirmation email failed:', confirmResult.error.message);
  }

  // Notification email to owner
  const notifyResult = await resend.emails.send({
    from: FROM_EMAIL,
    to: CONTACT_EMAIL,
    subject: `New Club Registration: ${clubName}`,
    html: `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px;">
        <h2 style="margin: 0 0 24px; font-size: 22px; font-weight: 700; color: #0D0D0B;">New Club Registration</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 15px;">
          <tr><td style="padding: 8px 12px; background: #f5f5f5; font-weight: 600; width: 180px;">Club Name</td><td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${safe.clubName}</td></tr>
          <tr><td style="padding: 8px 12px; background: #f5f5f5; font-weight: 600;">Contact Name</td><td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${safe.yourName}</td></tr>
          <tr><td style="padding: 8px 12px; background: #f5f5f5; font-weight: 600;">Role</td><td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${safe.role}</td></tr>
          <tr><td style="padding: 8px 12px; background: #f5f5f5; font-weight: 600;">Email</td><td style="padding: 8px 12px; border-bottom: 1px solid #eee;"><a href="mailto:${safe.email}">${safe.email}</a></td></tr>
          <tr><td style="padding: 8px 12px; background: #f5f5f5; font-weight: 600;">Category</td><td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${safe.category}</td></tr>
          <tr><td style="padding: 8px 12px; background: #f5f5f5; font-weight: 600;">Description</td><td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${safe.description}</td></tr>
          <tr><td style="padding: 8px 12px; background: #f5f5f5; font-weight: 600;">Instagram / Website</td><td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${safe.instagramOrWebsite}</td></tr>
          <tr><td style="padding: 8px 12px; background: #f5f5f5; font-weight: 600;">Biggest Challenge</td><td style="padding: 8px 12px;">${safe.biggestChallenge}</td></tr>
        </table>
      </div>
    `,
  });

  if (notifyResult.error) {
    console.warn('[waitlist/club-registration] Notification email failed:', notifyResult.error.message);
  }

  res.status(200).json({ success: true });
}));

export default router;
