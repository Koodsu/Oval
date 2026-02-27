import express from 'express';

import authRoutes from './routes/auth';
import activitiesRoutes from './routes/activities';
import podsRoutes from './routes/pods';
import messagesRoutes from './routes/messages';
import usersRoutes from './routes/users';

const app = express();

app.use(express.json());

// Routes
app.use('/auth', authRoutes);
app.use('/activities', activitiesRoutes);
app.use('/pods', podsRoutes);
app.use('/users', usersRoutes);

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
  app.listen(PORT, () => {
    console.log(`Bridge backend running on port ${PORT}`);
  });
}

export default app;
