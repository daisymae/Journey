import express from 'express';
import cors from 'cors';
import { PORT } from './config';
import { connectDB, disconnectDB } from './utils/database';
import patientRoutes from './routes/patients';
import journeyRoutes from './routes/journeys';
import runsRoutes from './routes/runs';
import { errorHandler } from './middleware/errorHandler';
import { journeyExecutor } from './services/journeyExecutor';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/patients', patientRoutes);
  app.use('/journeys', journeyRoutes);
  app.use('/journeys', runsRoutes);

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

    // Attempt to recover any overdue waiting runs on startup
    await journeyExecutor.recoverDueRuns().catch((err) => {
      console.error('[ERROR][EXECUTOR] Recovery failed on startup', err);
    });

    const server = app.listen(PORT, () => {
      console.log(`[ENGINE] Server listening on port ${PORT}`);
    });

    const shutdown = async (signal: string) => {
      console.log(`[ENGINE] Received ${signal}. Shutting down...`);
      server.close(async () => {
        // Stop timers to avoid dangling timeouts
        journeyExecutor.stopAllTimers();
        await disconnectDB();
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  })();
}

export default createApp;
