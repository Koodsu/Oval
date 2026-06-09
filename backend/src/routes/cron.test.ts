import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const runMaintenanceJobs = vi.hoisted(() => vi.fn());

vi.mock('../lib/maintenanceJobs', () => ({
  runMaintenanceJobs,
}));

import app from '../server';

describe('GET /cron/maintenance', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'test-cron-secret';
    runMaintenanceJobs.mockReset();
    runMaintenanceJobs.mockResolvedValue({
      lockedToCompleted: 1,
      formingToExpired: 2,
      completedAt: '2026-06-07T00:00:00.000Z',
    });
  });

  it('rejects requests without the cron bearer token', async () => {
    await request(app).get('/cron/maintenance').expect(401);
    expect(runMaintenanceJobs).not.toHaveBeenCalled();
  });

  it('runs maintenance for an authorized cron request', async () => {
    const res = await request(app)
      .get('/cron/maintenance')
      .set('Authorization', 'Bearer test-cron-secret')
      .expect(200);

    expect(runMaintenanceJobs).toHaveBeenCalledOnce();
    expect(res.body).toMatchObject({
      ok: true,
      lockedToCompleted: 1,
      formingToExpired: 2,
    });
  });
});
