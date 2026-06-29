import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../server';
import { CURRENT_TERMS_VERSION } from '../config/legal';

async function registerUnverified(email: string) {
  const res = await request(app)
    .post('/auth/register')
    .send({
      firstName: 'Gate',
      lastName: 'Tester',
      email,
      password: 'password123',
      classYear: 'Freshman',
      major: 'Computer Science',
      termsAccepted: true,
      ageConfirmed: true,
      termsVersion: CURRENT_TERMS_VERSION,
    })
    .expect(201);

  return res.body.token as string;
}

describe('verified university gate', () => {
  it('allows unverified users to read their own profile but blocks app surfaces', async () => {
    const token = await registerUnverified(`gate-${Date.now()}@osu.edu`);

    await request(app)
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const res = await request(app)
      .get('/activities')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(res.body.error).toMatch(/verify/i);
  });
});
