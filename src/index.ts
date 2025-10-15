import express from 'express';
import cors from 'cors';
import { PORT } from './config';
import { connectDB, disconnectDB } from './utils/database';
import patientRoutes from './routes/patients';
import journeyRoutes from './routes/journeys';
import { errorHandler } from './middleware/errorHandler';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/api/patients', patientRoutes);
  app.use('/api/journeys', journeyRoutes);

  // Health check
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.use(errorHandler);
  return app;
}

if (process.env.NODE_ENV !== 'test') {
  (async () => {
    const app = createApp();
    await connectDB().catch((err) => {
      console.error('[ERROR][DB] Could not connect to MongoDB on startup', err);
    });

    const server = app.listen(PORT, () => {
      console.log(`[ENGINE] Server listening on port ${PORT}`);
    });

    const shutdown = async (signal: string) => {
      console.log(`[ENGINE] Received ${signal}. Shutting down...`);
      server.close(async () => {
        await disconnectDB();
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  })();
}

export default createApp;
