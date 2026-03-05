import { Resend } from 'resend';

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

function getFromEmail(): string {
  return process.env.RESEND_FROM_EMAIL ?? 'noreply@bridge.app';
}

export async function sendVerificationEmail(to: string, code: string): Promise<void> {
  const resend = getResendClient();

  if (!resend) {
    console.log(`[emailService] No RESEND_API_KEY set. Verification code for ${to}: ${code}`);
    return;
  }

  const from = getFromEmail();
  console.log(`[emailService] Sending verification email to ${to} from ${from}`);

  const result = await resend.emails.send({
    from,
    to,
    subject: 'Your Bridge verification code',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #6d28d9;">Verify your Bridge account</h2>
        <p>Enter this code in the app to confirm your OSU email:</p>
        <div style="background: #f3f4f6; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
          <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #111827;">${code}</span>
        </div>
        <p style="color: #6b7280; font-size: 14px;">This code expires in 10 minutes. If you didn't create a Bridge account, you can safely ignore this email.</p>
      </div>
    `,
  });

  if (result.error) {
    console.error(`[emailService] Resend error for ${to}:`, result.error);
    throw new Error(`Email send failed: ${result.error.message}`);
  }

  console.log(`[emailService] Email sent successfully to ${to} (id: ${result.data?.id})`);
}
