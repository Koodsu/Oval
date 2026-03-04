import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';

import prisma from './prisma';
import authRoutes from './routes/auth';
import activitiesRoutes from './routes/activities';
import podsRoutes from './routes/pods';
import messagesRoutes from './routes/messages';
import usersRoutes from './routes/users';
import reportsRoutes from './routes/reports';
import adminReportsRoutes from './routes/adminReports';

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

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

app.use('/auth', authLimiter, authRoutes);
app.use('/activities', apiLimiter, activitiesRoutes);
app.use('/pods', apiLimiter, podsRoutes);
app.use('/users', apiLimiter, usersRoutes);
app.use('/reports', apiLimiter, reportsRoutes);
app.use('/admin/reports', apiLimiter, adminReportsRoutes);

// Messages are nested under pods: /pods/:id/messages
// Separate router with mergeParams so :id is accessible
app.use('/pods/:id/messages', apiLimiter, messagesRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT ?? 3000;

if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`Bridge backend running on port ${PORT}`);
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
