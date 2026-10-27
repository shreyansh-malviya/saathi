import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { PairingCode, ParentDevice } from '../models/Access.js';
import { Medicine, DoseLog } from '../models/Care.js';
import { Day } from '../models/Day.js';
import { validate, pairLimiter } from '../middleware/http.js';
import { requireParent, setParentCookie, clearParentCookie } from '../middleware/auth.js';
import { badRequest, notFound, AppError } from '../lib/errors.js';
import { randomToken, sha256 } from '../lib/tokens.js';
import { localDate, minutesToHhmm } from '../lib/time.js';
import { nowFor } from '../lib/clock.js';
import { evaluateDay } from '../services/ladder.js';
import { recordCheckIn, getOrCreateDay } from '../services/days.js';
import { dosesForDay } from '../services/medicines.js';
import { membersWithNames } from '../services/overview.js';
import { notifyUsers, logActivity, pushPublicKey } from '../services/notify.js';

// Endpoints used by the parent's phone. Everything here is designed for
// one-tap use: no passwords, idempotent actions, forgiving inputs.
const router = Router();

const pairSchema = z.object({
  code: z
    .string()
    .transform((s) => s.replace(/\D/g, ''))
    .refine((s) => s.length === 6, 'The code has 6 digits.'),
  label: z.string().trim().max(60).optional(),
});

function deviceLabel(ua = '') {
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/Android/i.test(ua)) return 'Android phone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Windows|Macintosh|Linux/i.test(ua)) return 'Computer browser';
  return 'Phone';
}

router.post('/pair', pairLimiter, validate(pairSchema), async (req, res) => {
  const now = new Date();
  // Claim the code atomically so it can be used exactly once.
  const code = await PairingCode.findOneAndUpdate(
    { codeHash: sha256(req.body.code), usedAt: null, expiresAt: { $gt: now } },
    { $set: { usedAt: now } },
    { new: true }
  );
  if (!code) throw badRequest('That code is wrong or has expired. Ask your family for a new one.');

  const token = randomToken(32);
  const device = await ParentDevice.create({
    circle: code.circle,
    tokenHash: sha256(token),
    label: req.body.label || deviceLabel(req.get('user-agent')),
    pairedBy: code.createdBy,
  });
  setParentCookie(res, token);
  await logActivity(code.circle, { actorType: 'parent', kind: 'device_paired', message: `A new phone was paired (${device.label}).` });
  res.status(201).json({ ok: true });
});

router.use(requireParent);

router.get('/today', async (req, res) => {
  const c = req.circle;
  const now = nowFor(c);
  const date = localDate(now, c.timezone);
  const day = await Day.findOne({ circle: c._id, date });
  const ev = evaluateDay(c, day, now);
  const members = await membersWithNames(c);
  res.json({
    parent: { name: c.parent.name, callName: c.parent.callName, language: c.parent.language },
    date,
    status: ev.status,
    punctuality: ev.punctuality,
    checkedInAt: day?.checkedInAt || null,
    mood: day?.mood || null,
    window: { start: minutesToHhmm(c.checkIn.windowStart), end: minutesToHhmm(c.checkIn.windowEnd) },
    doses: await dosesForDay(c, now),
    family: members.map((m) => ({ name: m.name, relation: m.relation, phone: m.phone })),
    push: { publicKey: pushPublicKey(), enabled: Boolean(req.device.pushSubscription?.endpoint) },
  });
});

const checkinSchema = z.object({ mood: z.enum(['good', 'okay', 'unwell']).default('good') });

router.post('/checkin', validate(checkinSchema), async (req, res) => {
  const { day, alreadyDone } = await recordCheckIn(req.circle, { mood: req.body.mood, source: 'parent' });
  res.status(alreadyDone ? 200 : 201).json({ alreadyDone, checkedInAt: day.checkedInAt, mood: day.mood });
});

/** Change today's mood after checking in (e.g. "actually I'm not well"). */
router.patch('/mood', validate(checkinSchema), async (req, res) => {
  const c = req.circle;
  const date = localDate(nowFor(c), c.timezone);
  const day = await Day.findOne({ circle: c._id, date });
  if (!day?.checkedInAt) throw badRequest('Check in first.');
  if (day.mood === req.body.mood) return res.json({ mood: day.mood });
  const wasUnwell = day.mood === 'unwell';
  day.mood = req.body.mood;
  await day.save();
  if (req.body.mood === 'unwell' && !wasUnwell) {
    await Promise.all([
      notifyUsers(c.members.map((m) => m.user), {
        circle: c._id,
        kind: 'unwell',
        severity: 'warn',
        title: `${c.parent.callName} is not feeling well today`,
        body: `${c.parent.callName} changed today's check-in to "not well". A call would help.`,
      }),
      logActivity(c._id, { actorType: 'parent', kind: 'mood', message: `${c.parent.callName} changed today's mood to not well.` }),
    ]);
  }
  res.json({ mood: day.mood });
});

const doseSchema = z.object({
  medicineId: z.string().refine((v) => mongoose.isValidObjectId(v), 'Invalid medicine.'),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

router.post('/doses', validate(doseSchema), async (req, res) => {
  const c = req.circle;
  const med = await Medicine.findOne({ _id: req.body.medicineId, circle: c._id, active: true });
  if (!med) throw notFound('Medicine not found.');
  if (!med.times.includes(req.body.time)) throw badRequest('That dose is not scheduled.');
  const date = localDate(nowFor(c), c.timezone);
  try {
    await DoseLog.create({ circle: c._id, medicine: med._id, date, time: req.body.time, source: 'parent' });
  } catch (err) {
    if (err.code !== 11000) throw err;
  }
  res.json({ doses: await dosesForDay(c) });
});

/** "I need help" - alerts every family member immediately. */
router.post('/help', async (req, res) => {
  const c = req.circle;
  const now = nowFor(c);
  const day = await getOrCreateDay(c._id, localDate(now, c.timezone));
  const last = day.helpRequests.at(-1)?.at;
  // Debounce: repeated taps within 2 minutes are one request.
  if (last && now - last < 2 * 60 * 1000) return res.json({ ok: true, repeated: true });
  await Day.updateOne({ _id: day._id }, { $push: { helpRequests: { at: now } } });
  await Promise.all([
    notifyUsers(c.members.map((m) => m.user), {
      circle: c._id,
      kind: 'help',
      severity: 'urgent',
      title: `${c.parent.callName} asked for help`,
      body: `${c.parent.callName} pressed "I need help" on their phone. Please call right away.`,
    }),
    logActivity(c._id, { actorType: 'parent', kind: 'help', message: `${c.parent.callName} pressed "I need help".` }),
  ]);
  res.status(201).json({ ok: true });
});

const subSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(10), auth: z.string().min(4) }),
});

router.post('/push/subscribe', validate(subSchema), async (req, res) => {
  if (!pushPublicKey()) throw new AppError(503, 'PUSH_DISABLED', 'Notifications are not set up on this server.');
  req.device.pushSubscription = req.body;
  await req.device.save();
  res.json({ ok: true });
});

router.post('/unpair', async (req, res) => {
  req.device.revokedAt = new Date();
  req.device.pushSubscription = null;
  await req.device.save();
  clearParentCookie(res);
  res.json({ ok: true });
});

export default router;
