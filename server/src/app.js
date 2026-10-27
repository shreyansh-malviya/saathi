import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import './config.js';
import { ensureDb, errorHandler, notFoundHandler } from './middleware/http.js';
import { requireUser } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import circleRoutes from './routes/circles.js';
import inviteRoutes from './routes/invites.js';
import parentRoutes from './routes/parent.js';
import meRoutes from './routes/me.js';
import systemRoutes from './routes/system.js';

// The Express app is created here and shared by two entry points:
//   src/index.js  - long running server for local dev (with an in-process scheduler)
//   api/index.js  - Vercel serverless function in production

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // behind Vercel's proxy: needed for rate limiting by IP and secure cookies
  app.disable('x-powered-by');

  app.use(helmet({ contentSecurityPolicy: false })); // CSP is set for the static site by Vercel headers
  app.use(express.json({ limit: '50kb' }));
  app.use(cookieParser());

  // The client is served from the same origin, so no CORS is needed. All API
  // responses are user specific and must never be cached by a CDN.
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  app.use('/api', ensureDb);
  app.use('/api', systemRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/invites', inviteRoutes);
  app.use('/api/parent', parentRoutes);
  app.use('/api/circles', requireUser, circleRoutes);
  app.use('/api/me', requireUser, meRoutes);

  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return app;
}
