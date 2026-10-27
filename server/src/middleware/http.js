import { ZodError } from 'zod';
import rateLimit from 'express-rate-limit';
import { AppError } from '../lib/errors.js';
import { connectDB } from '../db.js';

/** Validates req.body (or another part) against a zod schema and replaces it with the parsed value. */
export const validate = (schema, part = 'body') => (req, _res, next) => {
  req[part] = schema.parse(req[part] ?? {});
  next();
};

/** Makes sure Mongo is connected before any route runs (needed on serverless cold starts). */
export async function ensureDb(_req, _res, next) {
  await connectDB();
  next();
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.originalUrl}` } });
}

// Turns every error into the same JSON shape: { error: { code, message, fields? } }
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError) {
    const fields = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || '_';
      if (!fields[key]) fields[key] = issue.message;
    }
    const first = Object.values(fields)[0];
    return res.status(400).json({ error: { code: 'VALIDATION', message: first || 'Invalid input.', fields } });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ error: { code: 'DUPLICATE', message: 'That already exists.' } });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'BAD_JSON', message: 'Request body is not valid JSON.' } });
  }
  if (err?.name === 'MongooseServerSelectionError' || err?.name === 'MongoNetworkError') {
    console.error('[db]', err.message);
    return res.status(503).json({ error: { code: 'DB_UNAVAILABLE', message: 'We could not reach the database. Please try again in a moment.' } });
  }
  console.error('[unhandled]', req.method, req.originalUrl, err);
  return res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong on our side.' } });
}

const limiter = (windowMinutes, max, message) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ error: { code: 'RATE_LIMITED', message } }),
  });

// Note: on serverless each instance has its own counter, so these are a speed bump,
// not a hard guarantee. Pairing codes also expire in 15 minutes, which bounds guessing.
export const authLimiter = limiter(15, 20, 'Too many attempts. Please wait a few minutes and try again.');
export const pairLimiter = limiter(15, 10, 'Too many wrong codes. Please wait 15 minutes and ask for a new code.');
export const demoLimiter = limiter(60, 15, 'Too many demo circles from this network. Try again later.');
