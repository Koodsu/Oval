import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../server';
import prisma from '../prisma';
import { createTestUser, getAuthToken } from '../test/helpers';

describe('Web / invite-link routes (public)', () => {
  describe('GET /.well-known/apple-app-site-association', () => {
    it('returns 200 with JSON content-type', async () => {
      const res = await request(app)
        .get('/.well-known/apple-app-site-association')
        .expect(200);

      expect(res.headers['content-type']).toMatch(/application\/json/);
    });

    it('contains an applinks key', async () => {
      const res = await request(app)
        .get('/.well-known/apple-app-site-association')
        .expect(200);

      expect(res.body).toHaveProperty('applinks');
      expect(res.body.applinks).toHaveProperty('details');
      expect(Array.isArray(res.body.applinks.details)).toBe(true);
    });

    it('covers the /pod/* path', async () => {
      const res = await request(app)
        .get('/.well-known/apple-app-site-association')
        .expect(200);

      const paths: string[] = res.body.applinks.details.flatMap(
        (d: { paths: string[] }) => d.paths
      );
      expect(paths.some((p) => p.startsWith('/pod'))).toBe(true);
    });

    it('uses the fully qualified Apple app identifier', async () => {
      const res = await request(app)
        .get('/.well-known/apple-app-site-association')
        .expect(200);

      expect(res.body.applinks.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            appID: '687FPU46UV.com.bradyvb.ovalapp',
          }),
        ])
      );
    });

    it('requires no auth token', async () => {
      await request(app)
        .get('/.well-known/apple-app-site-association')
        .expect(200);
    });
  });

  describe('GET /.well-known/assetlinks.json', () => {
    it('returns 200 with JSON content-type', async () => {
      const res = await request(app)
        .get('/.well-known/assetlinks.json')
        .expect(200);

      expect(res.headers['content-type']).toMatch(/application\/json/);
    });

    it('returns a non-empty array', async () => {
      const res = await request(app)
        .get('/.well-known/assetlinks.json')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('contains the android app package', async () => {
      const res = await request(app)
        .get('/.well-known/assetlinks.json')
        .expect(200);

      const packageNames: string[] = res.body.map(
        (entry: { target: { package_name: string } }) => entry.target.package_name
      );
      expect(packageNames).toContain('com.theovalapp.app');
    });

    it('requires no auth token', async () => {
      await request(app)
        .get('/.well-known/assetlinks.json')
        .expect(200);
    });
  });

  describe('GET /pod/:podId', () => {
    const podId = '00000000-0000-4000-8000-000000000001';

    it('returns 200 with HTML content-type', async () => {
      const res = await request(app)
        .get(`/pod/${podId}`)
        .expect(200);

      expect(res.headers['content-type']).toMatch(/text\/html/);
    });

    it('includes the oval:// deep link for the given podId', async () => {
      const res = await request(app)
        .get(`/pod/${podId}`)
        .expect(200);

      expect(res.text).toContain(`oval://pod/${podId}`);
    });

    it('does not expose placeholder store links before listings exist', async () => {
      const res = await request(app)
        .get(`/pod/${podId}`)
        .expect(200);

      expect(res.text).toContain('Oval is coming soon to the App Store.');
      expect(res.text).not.toContain('id0000000000');
      expect(res.text).not.toContain('com.bridge.app');
    });

    it('includes a CTA to open the app', async () => {
      const res = await request(app)
        .get(`/pod/${podId}`)
        .expect(200);

      expect(res.text).toContain('Open in Oval');
    });

    it('requires no auth token', async () => {
      await request(app)
        .get(`/pod/${podId}`)
        .expect(200);
    });

    it('works with different pod IDs', async () => {
      const otherId = '11111111-2222-4333-a444-555555555555';
      const res = await request(app)
        .get(`/pod/${otherId}`)
        .expect(200);

      expect(res.text).toContain(`oval://pod/${otherId}`);
    });

    it('logs invite link opens with ref attribution', async () => {
      const ref = 'inviter-user-1';
      await request(app)
        .get(`/pod/${podId}?ref=${encodeURIComponent(ref)}`)
        .expect(200);

      const event = await prisma.analyticsEvent.findFirst({
        where: { name: 'invite.link_opened' },
        orderBy: { createdAt: 'desc' },
      });
      expect(event?.properties).toEqual({ podId, ref });
    });

    it('rejects non-UUID pod IDs', async () => {
      await request(app)
        .get('/pod/not-a-valid-uuid')
        .expect(400);
    });

    it('renders generic OG tags when the pod does not exist (no existence leak)', async () => {
      const res = await request(app)
        .get(`/pod/${podId}`)
        .expect(200);

      expect(res.text).toContain('<meta property="og:title" content="Join a Pod on Oval" />');
      expect(res.text).toContain('<meta property="og:site_name" content="Oval" />');
      expect(res.text).toContain('og:description');
    });

    it('renders pod details in OG tags for a public forming pod', async () => {
      const activity = await prisma.activity.findFirst();
      if (!activity) throw new Error('seed data missing');
      const meetupTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const pod = await prisma.pod.create({
        data: {
          activityId: activity.id,
          meetupTime,
          location: 'RPAC',
          locationType: 'public',
          minMembers: 2,
          maxMembers: 6,
          status: 'FORMING',
        },
      });

      const res = await request(app)
        .get(`/pod/${pod.id}`)
        .expect(200);

      expect(res.text).toContain(activity.title);
      expect(res.text).toContain('spots left');

      await prisma.pod.delete({ where: { id: pod.id } });
    });

    it('keeps OG tags generic for private pods', async () => {
      const activity = await prisma.activity.findFirst();
      if (!activity) throw new Error('seed data missing');
      const pod = await prisma.pod.create({
        data: {
          activityId: activity.id,
          meetupTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
          location: 'Secret spot',
          locationType: 'private',
          minMembers: 2,
          maxMembers: 6,
          status: 'FORMING',
        },
      });

      const res = await request(app)
        .get(`/pod/${pod.id}`)
        .expect(200);

      expect(res.text).toContain('<meta property="og:title" content="Join a Pod on Oval" />');
      expect(res.text).not.toContain('Secret spot');

      await prisma.pod.delete({ where: { id: pod.id } });
    });
  });

  describe('Web account deletion flow (public, Google Play requirement)', () => {
    function makeDeletionToken(userId: string, overrides: Record<string, unknown> = {}) {
      return jwt.sign(
        { purpose: 'account-deletion', userId, ...overrides },
        process.env.JWT_SECRET as string,
        { expiresIn: '1h' },
      );
    }

    describe('POST /delete-account/request', () => {
      it('returns ok for an unknown email (no user enumeration)', async () => {
        const res = await request(app)
          .post('/delete-account/request')
          .send({ email: 'nobody-here@osu.edu' })
          .expect(200);
        expect(res.body).toEqual({ ok: true });
      });

      it('returns ok for a known email without deleting anything', async () => {
        const user = await createTestUser();
        const res = await request(app)
          .post('/delete-account/request')
          .send({ email: user.email })
          .expect(200);
        expect(res.body).toEqual({ ok: true });

        const stillThere = await prisma.user.findUnique({ where: { id: user.id } });
        expect(stillThere).not.toBeNull();
        await prisma.user.delete({ where: { id: user.id } });
      });

      it('returns ok for malformed bodies', async () => {
        const res = await request(app)
          .post('/delete-account/request')
          .send({ email: 12345 })
          .expect(200);
        expect(res.body).toEqual({ ok: true });
      });
    });

    describe('GET /delete-account/confirm', () => {
      it('rejects a missing token', async () => {
        const res = await request(app).get('/delete-account/confirm').expect(400);
        expect(res.text).toContain('invalid or expired');
      });

      it('rejects a garbage token', async () => {
        const res = await request(app)
          .get('/delete-account/confirm?token=not-a-real-token')
          .expect(400);
        expect(res.text).toContain('invalid or expired');
      });

      it('rejects an auth-session token (wrong purpose)', async () => {
        const user = await createTestUser();
        const sessionToken = getAuthToken(user.id, user.email);
        const res = await request(app)
          .get(`/delete-account/confirm?token=${encodeURIComponent(sessionToken)}`)
          .expect(400);
        expect(res.text).toContain('invalid or expired');
        await prisma.user.delete({ where: { id: user.id } });
      });

      it('renders a confirmation form (not deletion) for a valid token', async () => {
        const user = await createTestUser();
        const token = makeDeletionToken(user.id);
        const res = await request(app)
          .get(`/delete-account/confirm?token=${encodeURIComponent(token)}`)
          .expect(200);
        expect(res.text).toContain('Permanently delete');
        expect(res.text).toContain('method="POST"');

        // GET must never delete — link prefetchers hit this URL.
        const stillThere = await prisma.user.findUnique({ where: { id: user.id } });
        expect(stillThere).not.toBeNull();
        await prisma.user.delete({ where: { id: user.id } });
      });
    });

    describe('POST /delete-account/confirm', () => {
      it('deletes the account with a valid token', async () => {
        const user = await createTestUser();
        const token = makeDeletionToken(user.id);
        const res = await request(app)
          .post('/delete-account/confirm')
          .type('form')
          .send({ token })
          .expect(200);
        expect(res.text).toContain('has been deleted');

        const gone = await prisma.user.findUnique({ where: { id: user.id } });
        expect(gone).toBeNull();
      });

      it('rejects an invalid token without deleting', async () => {
        await request(app)
          .post('/delete-account/confirm')
          .type('form')
          .send({ token: 'garbage' })
          .expect(400);
      });

      it('is idempotent for an already-deleted account', async () => {
        const user = await createTestUser();
        const token = makeDeletionToken(user.id);
        await prisma.user.delete({ where: { id: user.id } });

        const res = await request(app)
          .post('/delete-account/confirm')
          .type('form')
          .send({ token })
          .expect(200);
        expect(res.text).toContain('has been deleted');
      });
    });
  });
});
