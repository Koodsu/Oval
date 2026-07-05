// Campus product: all "today / tonight / Sunday 6pm" logic is Columbus time.
// vercel.json also sets TZ; this is a defensive fallback for other hosts.
process.env.TZ = process.env.TZ || 'America/New_York';

import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from './config/jwt';

import prisma from './prisma';
import authRoutes from './routes/auth';
import activitiesRoutes from './routes/activities';
import podsRoutes from './routes/pods';
import messagesRoutes from './routes/messages';
import usersRoutes from './routes/users';
import reportsRoutes from './routes/reports';
import adminReportsRoutes from './routes/adminReports';
import adminReviewRoutes from './routes/adminReview';
import attendanceRoutes from './routes/attendance';
import webRoutes from './routes/web';
import friendsRoutes from './routes/friends';
import directMessagesRoutes from './routes/directMessages';
import inboxRoutes from './routes/inbox';
import podInvitesRoutes from './routes/podInvites';
import recapsRoutes from './routes/recaps';
import podWaitlistRoutes from './routes/podWaitlist';
import waitlistRoutes from './routes/waitlist';
import clubsRoutes from './routes/clubs';
import adminClubClaimsRoutes from './routes/adminClubClaims';
import adminActivityRequestsRoutes from './routes/adminActivityRequests';
import analyticsRoutes from './routes/analytics';
import cronRoutes from './routes/cron';
import { validateProductionEnvironment } from './config/productionEnv';

validateProductionEnvironment();
const app = express();
app.set('trust proxy', 1);

app.use((_req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      scriptSrc: [
        "'self'",
        ((_req: unknown, res: unknown) => {
          const locals = (res as { locals?: { cspNonce?: string } }).locals;
          return `'nonce-${locals?.cspNonce ?? ''}'`;
        }) as never,
      ],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
    },
  },
  // Allow cross-origin loading of avatar images by the React Native client
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(
  cors({
    origin: (() => {
      if (process.env.NODE_ENV === 'production') {
        if (!process.env.CORS_ORIGIN) {
          throw new Error('CORS_ORIGIN environment variable is required in production');
        }
        const origins = process.env.CORS_ORIGIN.split(',').map(o => o.trim());
        return origins.length === 1 ? origins[0] : origins;
      }
      return process.env.CORS_ORIGIN ?? 'http://localhost:3000';
    })(),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.options('*', cors());

// HTTP request logging — skip in test to keep output clean
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Public web routes: .well-known verification files + pod invite landing page
// Must be mounted before express.json() and rate limiters so they remain publicly accessible
app.use(webRoutes);

// Serve uploaded avatars as static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use(express.json({ limit: '64kb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
  skip: () => process.env.NODE_ENV === 'test',
});

/**
 * Rate-limit key: authenticated user ID when a valid JWT is present, IP
 * otherwise. Per-IP limiting alone breaks on campus Wi-Fi, where many
 * students share one NAT egress IP — a handful of users polling chat would
 * exhaust the shared IP bucket and the app would appear to stop refreshing
 * for everyone behind it.
 */
function userOrIpKey(req: Request): string {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(header.slice(7), getJwtSecret()) as { userId?: string };
      if (payload?.userId) return `user:${payload.userId}`;
    } catch {
      // Invalid or expired token — fall through to IP keying.
    }
  }
  return ipKeyGenerator(req.ip ?? '');
}

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: { error: 'Too many requests, please try again later' },
  skip: () => process.env.NODE_ENV === 'test',
});

const waitlistLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: { error: 'Too many requests, please try again later' },
  skip: () => process.env.NODE_ENV === 'test',
});

// Generous app-wide backstop: every endpoint past this point — including
// /health and any route without its own limiter — gets some abuse protection.
// Real volumetric DDoS mitigation lives at the Vercel edge firewall; this only
// caps per-key bursts, and on serverless the in-memory count is per-instance,
// so treat it as best-effort rather than a hard guarantee. The stricter
// per-route limiters below still apply on top of this. Mounted AFTER the public
// webRoutes and /uploads so .well-known files (Apple AASA) and avatars stay
// unthrottled.
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: { error: 'Too many requests, please try again later' },
  skip: () => process.env.NODE_ENV === 'test',
});
app.use(globalLimiter);

app.use('/auth', authLimiter, authRoutes);
app.use('/activities', apiLimiter, activitiesRoutes);
// Pod invites: /pods/invites and /pods/:id/invite
// Must be mounted before the main pod router so /pods/invites
// doesn't get consumed by the generic /pods/:id handler.
app.use('/pods', apiLimiter, podInvitesRoutes);
app.use('/pods', apiLimiter, podsRoutes);
app.use('/pods', apiLimiter, attendanceRoutes);
app.use('/users', apiLimiter, usersRoutes);
app.use('/clubs', apiLimiter, clubsRoutes);
app.use('/admin/club-claims', apiLimiter, adminClubClaimsRoutes);
app.use('/admin/activity-requests', apiLimiter, adminActivityRequestsRoutes);
app.use('/reports', apiLimiter, reportsRoutes);
app.use('/admin/reports/review', apiLimiter, adminReviewRoutes);
app.use('/admin/reports', apiLimiter, adminReportsRoutes);
app.use('/analytics', apiLimiter, analyticsRoutes);
app.use('/cron', apiLimiter, cronRoutes);
app.use('/friends', apiLimiter, friendsRoutes);
app.use('/inbox', apiLimiter, inboxRoutes);
app.use('/messages', apiLimiter, directMessagesRoutes);
app.use('/pods', apiLimiter, recapsRoutes);
app.use('/pods', apiLimiter, podWaitlistRoutes);

// Messages are nested under pods: /pods/:id/messages
// Separate router with mergeParams so :id is accessible
app.use('/pods/:id/messages', apiLimiter, messagesRoutes);

//Waitlist
app.use('/waitlist', waitlistLimiter, waitlistRoutes);

app.get('/health', async (_req, res) => {
  try {
    // Actually touch the database — a bare "ok" hid a paused/unreachable DB and
    // made login hangs hard to diagnose.
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'ok' });
  } catch (err) {
    console.error('[health] database check failed:', err);
    res.status(503).json({ status: 'error', database: 'unreachable' });
  }
});

// 404 — no route matched
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Centralized error handler — catches anything forwarded via next(err) or
// unhandled rejections in asyncHandler-wrapped routes
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[error]', err.message, err.stack);
  const status = (err as Error & { status?: number }).status ?? 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT ?? 3000;

if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`Oval backend running on port ${PORT}`);
  });

  const gracefulShutdown = () => {
    server.close(() => {
      prisma.$disconnect().then(() => process.exit(0));
    });
  };
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

export default app;
