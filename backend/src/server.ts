import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { rateLimit } from 'express-rate-limit';
import path from 'path';

import prisma from './prisma';
import { startReminderScheduler, startPodExpiryScheduler } from './lib/reminderScheduler';
import authRoutes from './routes/auth';
import activitiesRoutes from './routes/activities';
import podsRoutes from './routes/pods';
import messagesRoutes from './routes/messages';
import usersRoutes from './routes/users';
import reportsRoutes from './routes/reports';
import adminReportsRoutes from './routes/adminReports';
import attendanceRoutes from './routes/attendance';
import webRoutes from './routes/web';
import friendsRoutes from './routes/friends';
import directMessagesRoutes from './routes/directMessages';
import podInvitesRoutes from './routes/podInvites';
import recapsRoutes from './routes/recaps';
import podWaitlistRoutes from './routes/podWaitlist';
import waitlistRoutes from './routes/waitlist';
import clubsRoutes from './routes/clubs';

const app = express();
app.set('trust proxy', 1);

app.use(helmet({
  // CSP is intentionally disabled because the pod invite landing page
  // (GET /pod/:id) injects a JSON data blob via an inline <script> tag.
  // TODO: replace the inline script with a fetch() call so CSP can be
  // re-enabled with a strict policy across all routes.
  contentSecurityPolicy: false,
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

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
  skip: () => process.env.NODE_ENV === 'test',
});

const waitlistLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
  skip: () => process.env.NODE_ENV === 'test',
});

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
app.use('/reports', apiLimiter, reportsRoutes);
app.use('/admin/reports', apiLimiter, adminReportsRoutes);
app.use('/friends', apiLimiter, friendsRoutes);
app.use('/messages', apiLimiter, directMessagesRoutes);
app.use('/pods', apiLimiter, recapsRoutes);
app.use('/pods', apiLimiter, podWaitlistRoutes);

// Messages are nested under pods: /pods/:id/messages
// Separate router with mergeParams so :id is accessible
app.use('/pods/:id/messages', apiLimiter, messagesRoutes);

//Waitlist
app.use('/waitlist', waitlistLimiter, waitlistRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
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
    console.log(`Bridge backend running on port ${PORT}`);
    startReminderScheduler();
    startPodExpiryScheduler();
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
