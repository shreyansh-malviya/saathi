import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../models/User.js';
import { Circle } from '../models/Circle.js';
import { validate, authLimiter } from '../middleware/http.js';
import { requireUser, setSessionCookie, clearSessionCookie } from '../middleware/auth.js';
import { conflict, unauthorized } from '../lib/errors.js';

const router = Router();

const email = z.string().trim().toLowerCase().email('Enter a valid email address.').max(120);
const password = z.string().min(8, 'Password must be at least 8 characters.').max(72, 'Password is too long.');

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Tell us your name.').max(60),
  email,
  password,
});

const loginSchema = z.object({ email, password: z.string().min(1, 'Enter your password.') });

async function myCircles(userId) {
  const circles = await Circle.find({ 'members.user': userId }).sort({ createdAt: 1 });
  return circles.map((c) => ({
    id: c._id.toString(),
    callName: c.parent.callName,
    parentName: c.parent.name,
    city: c.parent.city,
    role: c.memberOf(userId)?.role,
    isDemo: c.isDemo,
  }));
}

router.post('/register', authLimiter, validate(registerSchema), async (req, res) => {
  const { name, email: mail, password: pw } = req.body;
  if (await User.exists({ email: mail })) {
    throw conflict('An account with this email already exists. Try signing in instead.');
  }
  const user = await User.create({ name, email: mail, passwordHash: await bcrypt.hash(pw, 10) });
  setSessionCookie(res, user);
  res.status(201).json({ user: user.toPublic(), circles: [] });
});

router.post('/login', authLimiter, validate(loginSchema), async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select('+passwordHash');
  // Same message for unknown email and wrong password, so accounts cannot be enumerated.
  const ok = user && (await bcrypt.compare(req.body.password, user.passwordHash));
  if (!ok) throw unauthorized('That email and password do not match.');
  setSessionCookie(res, user);
  res.json({ user: user.toPublic(), circles: await myCircles(user._id) });
});

router.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireUser, async (req, res) => {
  res.json({ user: req.user.toPublic(), circles: await myCircles(req.user._id) });
});

export default router;
