import { Router, Response } from 'express';
import { Prisma } from '@prisma/client';
import { AuthRequest, optionalAuth } from '../middleware/auth';
import prisma from '../prisma';

const router = Router();

const EVENT_NAME_REGEX = /^[a-zA-Z0-9_.:-]{1,80}$/;
const MAX_PROPERTIES_BYTES = 4000;

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

router.post('/events', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const properties = req.body?.properties;

  if (!EVENT_NAME_REGEX.test(name)) {
    res.status(400).json({ error: 'Invalid event name' });
    return;
  }

  if (properties !== undefined && !isJsonObject(properties)) {
    res.status(400).json({ error: 'properties must be an object when provided' });
    return;
  }

  if (properties !== undefined && Buffer.byteLength(JSON.stringify(properties), 'utf8') > MAX_PROPERTIES_BYTES) {
    res.status(400).json({ error: 'properties is too large' });
    return;
  }

  try {
    await prisma.analyticsEvent.create({
      data: {
        userId: req.user?.userId ?? null,
        name,
        properties: properties === undefined ? undefined : (properties as Prisma.InputJsonValue),
      },
    });
    res.status(204).send();
  } catch (err) {
    console.error('[analytics] Failed to record event:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
