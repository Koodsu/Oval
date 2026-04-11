import { Router, Request, Response } from 'express';
import { Resend } from 'resend';
import { asyncHandler } from '../lib/asyncHandler';

const router = Router();
const resend = new Resend(process.env.RESEND_API_KEY);

// POST /waitlist — add an email to the Resend contact list
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body as { email?: unknown };

  if (!email || typeof email !== 'string' || !email.trim()) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  await resend.contacts.create({
    email: email.trim(),
    unsubscribed: false,
  });

  res.status(201).json({ success: true });
}));

export default router;
