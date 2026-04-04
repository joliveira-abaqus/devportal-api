import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import * as Sentry from '@sentry/node';

import healthRoutes from './routes/health.routes';
import authRoutes from './routes/auth.routes';
import requestsRoutes from './routes/requests.routes';
import { errorMiddleware } from './middleware/error.middleware';

const app = express();

// Sentry
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 1.0,
  });
}

// Middleware global
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Rotas
app.use(healthRoutes);
app.use(authRoutes);
app.use(requestsRoutes);

// Error handler global
app.use(errorMiddleware);

export default app;
