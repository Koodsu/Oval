import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server';
import prisma from '../prisma';
import { registerAndGetToken } from '../test/helpers';

describe('GET /activities', () => {
  it('returns 401 without auth', async () => {
    await request(app).get('/activities').expect(401);
  });

  it('returns activities when authenticated', async () => {
    const { token } = await registerAndGetToken('Alice', 'alice@activities.test.com', 'password123');
    const res = await request(app)
      .get('/activities')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('title');
    expect(res.body[0]).toHaveProperty('category');
    expect(res.body[0]).toHaveProperty('description');
  });

  it('filters by category when provided', async () => {
    const { token } = await registerAndGetToken('Bob', 'bob@activities.test.com', 'password123');
    const res = await request(app)
      .get('/activities')
      .query({ category: 'Sports & Fitness' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    res.body.forEach((a: { category: string }) => {
      expect(a.category).toBe('Sports & Fitness');
    });
  });
});

describe('GET /activities/locations', () => {
  it('returns 401 without auth', async () => {
    await request(app)
      .get('/activities/locations')
      .query({ category: 'Food & Drink' })
      .expect(401);
  });

  it('returns locations for a category when authenticated', async () => {
    const { token } = await registerAndGetToken('Carol', 'carol@activities.test.com', 'password123');
    const res = await request(app)
      .get('/activities/locations')
      .query({ category: 'Food & Drink' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toContain("Sloopy's Diner");
  });

  it('requires category param', async () => {
    const { token } = await registerAndGetToken('Dave', 'dave@activities.test.com', 'password123');
    await request(app)
      .get('/activities/locations')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });
});

describe('GET /activities/:id/locations', () => {
  it('returns locations for an activity by its category when authenticated', async () => {
    const { token } = await registerAndGetToken('Eve', 'eve@activities.test.com', 'password123');
    const activity = await prisma.activity.findFirst({
      where: { category: 'Food & Drink' },
    });
    if (!activity) throw new Error('No Food & Drink activity in seed');

    const res = await request(app)
      .get(`/activities/${activity.id}/locations`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('returns 404 for unknown activity id', async () => {
    const { token } = await registerAndGetToken('Frank', 'frank@activities.test.com', 'password123');
    await request(app)
      .get('/activities/00000000-0000-0000-0000-000000000000/locations')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });
});
