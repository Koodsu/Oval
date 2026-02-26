import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server';
import prisma from '../prisma';

describe('GET /activities', () => {
  it('returns activities (no auth required)', async () => {
    const res = await request(app).get('/activities').expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('title');
    expect(res.body[0]).toHaveProperty('category');
    expect(res.body[0]).toHaveProperty('description');
  });

  it('filters by category when provided', async () => {
    const res = await request(app)
      .get('/activities')
      .query({ category: 'Sports & Fitness' })
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    res.body.forEach((a: { category: string }) => {
      expect(a.category).toBe('Sports & Fitness');
    });
  });
});

describe('GET /activities/locations', () => {
  it('returns locations for a category', async () => {
    const res = await request(app)
      .get('/activities/locations')
      .query({ category: 'Food & Drink' })
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toContain("Sloopy's Diner");
  });

  it('requires category param', async () => {
    await request(app).get('/activities/locations').expect(400);
  });
});

describe('GET /activities/:id/locations', () => {
  it('returns locations for an activity by its category', async () => {
    const activity = await prisma.activity.findFirst({
      where: { category: 'Food & Drink' },
    });
    if (!activity) throw new Error('No Food & Drink activity in seed');

    const res = await request(app)
      .get(`/activities/${activity.id}/locations`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('returns 404 for unknown activity id', async () => {
    await request(app)
      .get('/activities/00000000-0000-0000-0000-000000000000/locations')
      .expect(404);
  });
});
