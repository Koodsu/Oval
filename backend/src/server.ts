import express from 'express';
import cors from 'cors';

import prisma from './prisma';
import authRoutes from './routes/auth';
import activitiesRoutes from './routes/activities';
import podsRoutes from './routes/pods';
import messagesRoutes from './routes/messages';
import usersRoutes from './routes/users';
import reportsRoutes from './routes/reports';
import adminReportsRoutes from './routes/adminReports';

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/auth', authRoutes);
app.use('/activities', activitiesRoutes);
app.use('/pods', podsRoutes);
app.use('/users', usersRoutes);
app.use('/reports', reportsRoutes);
app.use('/admin/reports', adminReportsRoutes);

// Messages are nested under pods: /pods/:id/messages
// We use a separate router with mergeParams so :id is accessible
app.use('/pods/:id/messages', messagesRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT ?? 3000;

// Only start listening when run directly (not when imported for tests)
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
