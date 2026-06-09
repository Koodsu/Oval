import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const resendMocks = vi.hoisted(() => ({
  createContact: vi.fn(),
  listContacts: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock('resend', () => ({
  Resend: class {
    contacts = {
      create: resendMocks.createContact,
      list: resendMocks.listContacts,
    };

    emails = {
      send: resendMocks.sendEmail,
    };
  },
}));

import app from '../server';

describe('public waitlist routes', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.RESEND_FROM_EMAIL = 'noreply@joinbridgeapp.com';
    process.env.CONTACT_EMAIL = 'contactus@joinbridgeapp.com';
    resendMocks.createContact.mockReset().mockResolvedValue({ data: { id: 'contact' }, error: null });
    resendMocks.listContacts.mockReset().mockResolvedValue({
      data: { data: [], has_more: false },
      error: null,
    });
    resendMocks.sendEmail.mockReset().mockResolvedValue({ data: { id: 'email' }, error: null });
  });

  it('loads the backend and returns 503 when Resend is not configured', async () => {
    delete process.env.RESEND_API_KEY;

    await request(app).post('/waitlist').send({ email: 'student@osu.edu' }).expect(503);
    expect(resendMocks.createContact).not.toHaveBeenCalled();
  });

  it('validates waitlist email addresses', async () => {
    await request(app).post('/waitlist').send({ email: 'not-an-email' }).expect(400);
    expect(resendMocks.createContact).not.toHaveBeenCalled();
  });

  it('escapes club registration fields before rendering email HTML', async () => {
    await request(app)
      .post('/waitlist/club-registration')
      .send({
        clubName: '<img src=x onerror=alert(1)> Club',
        yourName: '<b>Leader</b>',
        role: 'President',
        email: 'leader@osu.edu',
        category: 'Academic',
        description: '<script>alert(1)</script>',
      })
      .expect(200);

    expect(resendMocks.sendEmail).toHaveBeenCalledTimes(2);
    const confirmation = resendMocks.sendEmail.mock.calls[0][0] as { html: string };
    const notification = resendMocks.sendEmail.mock.calls[1][0] as { html: string; to: string };
    expect(confirmation.html).toContain('&lt;img src=x onerror=alert(1)&gt; Club');
    expect(notification.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(notification.html).not.toContain('<script>alert(1)</script>');
    expect(notification.to).toBe('contactus@joinbridgeapp.com');
  });
});
