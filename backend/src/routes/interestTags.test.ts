import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server';
import { registerAndGetToken } from '../test/helpers';

describe('Interest Tags — PATCH /users/me', () => {
  let token: string;

  beforeEach(async () => {
    const u = await registerAndGetToken('Tag Tester', 'tagtester', 'password123');
    token = u.token;
  });

  it('saves valid interest tags', async () => {
    const res = await request(app)
      .patch('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ interestTags: ['Gym', 'Gaming', 'Music'] })
      .expect(200);

    expect(res.body.interestTags).toEqual(['Gym', 'Gaming', 'Music']);
  });

  it('returns empty array when no tags set', async () => {
    const res = await request(app)
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.interestTags).toEqual([]);
  });

  it('allows up to 5 tags', async () => {
    const res = await request(app)
      .patch('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ interestTags: ['Gym', 'Gaming', 'Music', 'Art', 'Film'] })
      .expect(200);

    expect(res.body.interestTags).toHaveLength(5);
  });

  it('rejects more than 5 tags', async () => {
    const res = await request(app)
      .patch('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ interestTags: ['Gym', 'Gaming', 'Music', 'Art', 'Film', 'Food'] })
      .expect(400);

    expect(res.body.error).toMatch(/5/);
  });

  it('rejects invalid tag values', async () => {
    const res = await request(app)
      .patch('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ interestTags: ['Gym', 'NotATag'] })
      .expect(400);

    expect(res.body.error).toMatch(/NotATag/);
  });

  it('rejects non-array interestTags', async () => {
    await request(app)
      .patch('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ interestTags: 'Gym' })
      .expect(400);
  });

  it('clears tags with empty array', async () => {
    await request(app)
      .patch('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ interestTags: ['Gym', 'Gaming'] })
      .expect(200);

    const res = await request(app)
      .patch('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ interestTags: [] })
      .expect(200);

    expect(res.body.interestTags).toEqual([]);
  });

  it('interestTags appear on GET /users/:id (public profile)', async () => {
    const u2 = await registerAndGetToken('Tag Viewer', 'tagviewer', 'password123');

    await request(app)
      .patch('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ interestTags: ['Sports', 'Outdoors'] })
      .expect(200);

    const u = await request(app)
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const profileRes = await request(app)
      .get(`/users/${u.body.id}`)
      .set('Authorization', `Bearer ${u2.token}`)
      .expect(200);

    expect(profileRes.body.interestTags).toEqual(['Sports', 'Outdoors']);
  });
});
