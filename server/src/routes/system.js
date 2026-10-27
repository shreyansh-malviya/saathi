import { Router } from 'express';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { config } from '../config.js';
import { demoLimiter } from '../middleware/http.js';
import { setSessionCookie } from '../middleware/auth.js';
import { unauthorized } from '../lib/errors.js';
import { tickAll } from '../services/days.js';
import { createDemo, cleanupDemos } from '../services/demo.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true, db: mongoose.connection.readyState === 1 ? 'up' : 'connecting', time: new Date().toISOString() });
});

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/**
 * Scheduler entry point. Called every few minutes by GitHub Actions (and once a
 * day by Vercel Cron as a backstop). Protected by CRON_SECRET as a bearer token.
 */
async function cron(req, res) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!config.cronSecret || !safeEqual(token, config.cronSecret)) throw unauthorized('Bad cron secret.');
  const started = Date.now();
  const results = await tickAll();
  const removedDemos = await cleanupDemos();
  res.json({
    ok: true,
    circles: results.length,
    moved: results.filter((r) => r.moved).length,
    errors: results.filter((r) => r.error).length,
    removedDemos,
    ms: Date.now() - started,
  });
}
router.get('/cron/tick', cron);
router.post('/cron/tick', cron);

/** One click demo: creates a private demo circle and signs you in as "Rohan". */
router.post('/demo', demoLimiter, async (_req, res) => {
  const { user, circle } = await createDemo();
  setSessionCookie(res, user);
  res.status(201).json({ user: user.toPublic(), circleId: circle._id.toString() });
});

export default router;
