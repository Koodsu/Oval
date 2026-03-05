import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server';

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
      expect(packageNames).toContain('com.bridge.app');
    });

    it('requires no auth token', async () => {
      await request(app)
        .get('/.well-known/assetlinks.json')
        .expect(200);
    });
  });

  describe('GET /pod/:podId', () => {
    const podId = 'test-pod-123';

    it('returns 200 with HTML content-type', async () => {
      const res = await request(app)
        .get(`/pod/${podId}`)
        .expect(200);

      expect(res.headers['content-type']).toMatch(/text\/html/);
    });

    it('includes the bridge:// deep link for the given podId', async () => {
      const res = await request(app)
        .get(`/pod/${podId}`)
        .expect(200);

      expect(res.text).toContain(`bridge://pod/${podId}`);
    });

    it('includes an app store install link', async () => {
      const res = await request(app)
        .get(`/pod/${podId}`)
        .expect(200);

      expect(res.text).toMatch(/apps\.apple\.com|play\.google\.com/);
    });

    it('includes a CTA to open the app', async () => {
      const res = await request(app)
        .get(`/pod/${podId}`)
        .expect(200);

      expect(res.text).toContain('Open in Bridge');
    });

    it('requires no auth token', async () => {
      await request(app)
        .get(`/pod/${podId}`)
        .expect(200);
    });

    it('works with different pod IDs', async () => {
      const otherId = 'clx99abc123';
      const res = await request(app)
        .get(`/pod/${otherId}`)
        .expect(200);

      expect(res.text).toContain(`bridge://pod/${otherId}`);
    });
  });
});
