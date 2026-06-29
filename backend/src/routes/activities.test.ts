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

describe('activity requests', () => {
  it('lets a student submit and an admin approve a catalog addition once', async () => {
    const student = await registerAndGetToken('Request Student', 'request-student@activities.test.com', 'password123');
    const admin = await registerAndGetToken('Request Admin', 'request-admin@activities.test.com', 'password123');
    const previousAdmins = process.env.ADMIN_USER_IDS;
    process.env.ADMIN_USER_IDS = admin.user.id;

    try {
      const title = `Campus Croquet ${Date.now()}`;
      const submitted = await request(app)
        .post('/activities/requests')
        .set('Authorization', `Bearer ${student.token}`)
        .send({
          title,
          category: 'Outdoors',
          description: 'Low-key lawn games around campus.',
          defaultLocation: 'The Oval',
        })
        .expect(201);
      expect(submitted.body.status).toBe('PENDING');

      const queue = await request(app)
        .get('/admin/activity-requests')
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);
      expect(queue.body.requests.some((row: any) => row.id === submitted.body.id)).toBe(true);

      const approved = await request(app)
        .post(`/admin/activity-requests/${submitted.body.id}/approve`)
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);
      expect(approved.body.request.status).toBe('APPROVED');
      expect(approved.body.activity.title).toBe(title);

      const duplicate = await request(app)
        .post('/activities/requests')
        .set('Authorization', `Bearer ${student.token}`)
        .send({ title: title.toUpperCase(), category: 'Outdoors' })
        .expect(201);
      const duplicateApproval = await request(app)
        .post(`/admin/activity-requests/${duplicate.body.id}/approve`)
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);
      expect(duplicateApproval.body.activity.id).toBe(approved.body.activity.id);

      const matches = await prisma.activity.findMany({
        where: { title: { equals: title, mode: 'insensitive' } },
      });
      expect(matches).toHaveLength(1);
    } finally {
      if (previousAdmins === undefined) delete process.env.ADMIN_USER_IDS;
      else process.env.ADMIN_USER_IDS = previousAdmins;
    }
  });

  it('lets an admin reject a pending activity request', async () => {
    const student = await registerAndGetToken('Reject Student', 'reject-student@activities.test.com', 'password123');
    const admin = await registerAndGetToken('Reject Admin', 'reject-admin@activities.test.com', 'password123');
    const previousAdmins = process.env.ADMIN_USER_IDS;
    process.env.ADMIN_USER_IDS = admin.user.id;

    try {
      const submitted = await request(app)
        .post('/activities/requests')
        .set('Authorization', `Bearer ${student.token}`)
        .send({ title: `Rejected Activity ${Date.now()}`, category: 'Social' })
        .expect(201);

      const rejected = await request(app)
        .post(`/admin/activity-requests/${submitted.body.id}/reject`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ reviewNote: 'Too similar to the current catalog.' })
        .expect(200);

      expect(rejected.body.request.status).toBe('REJECTED');
      expect(rejected.body.request.reviewNote).toBe('Too similar to the current catalog.');
    } finally {
      if (previousAdmins === undefined) delete process.env.ADMIN_USER_IDS;
      else process.env.ADMIN_USER_IDS = previousAdmins;
    }
  });
});
