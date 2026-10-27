import { Router } from 'express';
import { z } from 'zod';
import { Circle } from '../models/Circle.js';
import { Day } from '../models/Day.js';
import { Invite, PairingCode, ParentDevice } from '../models/Access.js';
import { Activity, Medicine, DoseLog, Task, Notification } from '../models/Care.js';
import { validate } from '../middleware/http.js';
import { loadCircle, requireOwner } from '../middleware/auth.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { hhmmToMinutes, isValidTimezone, localDate, lastNDates, DEFAULT_TZ } from '../lib/time.js';
import { randomToken, sha256, sixDigitCode } from '../lib/tokens.js';
import { validateSchedule, evaluateDay } from '../services/ladder.js';
import { tickCircle, getOrCreateDay } from '../services/days.js';
import { buildOverview, circleSummary, membersWithNames } from '../services/overview.js';
import { notifyUsers, logActivity } from '../services/notify.js';
import { config } from '../config.js';
import { nowFor } from '../lib/clock.js';
import careRouter from './care.js';
import { fastForward, resetDemoMorning } from '../services/demo.js';

const router = Router();

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time like 07:30.');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-11-02.');

const parentSchema = z.object({
  name: z.string().trim().min(2, "Enter your parent's name.").max(60),
  callName: z.string().trim().min(1, 'What do you call them? e.g. Maa, Papa').max(20),
  city: z.string().trim().max(40).optional().default(''),
  language: z.enum(['en', 'hi']).default('hi'),
});

const scheduleSchema = z.object({
  windowStart: hhmm,
  windowEnd: hhmm,
  primaryAfter: z.coerce.number().int().min(5).max(240).default(30),
  circleAfter: z.coerce.number().int().min(10).max(480).default(60),
});

function toCheckIn(s) {
  const checkIn = {
    windowStart: hhmmToMinutes(s.windowStart),
    windowEnd: hhmmToMinutes(s.windowEnd),
    primaryAfter: s.primaryAfter,
    circleAfter: s.circleAfter,
  };
  const problem = validateSchedule(checkIn);
  if (problem) throw badRequest(problem, { field: 'schedule' });
  return checkIn;
}

const tzSchema = z
  .string()
  .default(DEFAULT_TZ)
  .refine((tz) => isValidTimezone(tz), 'Unknown timezone.');

// ---------------------------------------------------------------- create / list

const createSchema = z.object({
  parent: parentSchema,
  schedule: scheduleSchema.default({ windowStart: '07:00', windowEnd: '10:00' }),
  timezone: tzSchema,
  relation: z.string().trim().max(30).default(''),
  phone: z.string().trim().max(20).default(''),
});

router.post('/', validate(createSchema), async (req, res) => {
  const count = await Circle.countDocuments({ 'members.user': req.user._id });
  if (count >= 5) throw badRequest('You can be part of at most 5 circles.');
  const { parent, schedule, timezone, relation, phone } = req.body;
  const circle = await Circle.create({
    parent,
    timezone,
    checkIn: toCheckIn(schedule),
    createdBy: req.user._id,
    members: [{ user: req.user._id, role: 'owner', relation, phone, order: 1 }],
  });
  await logActivity(circle._id, {
    actorType: 'user',
    actor: req.user._id,
    kind: 'circle_created',
    message: `${req.user.name} started ${parent.callName}'s circle.`,
  });
  res.status(201).json({ circle: circleSummary(circle) });
});

// Everything below needs membership of :circleId.
router.use('/:circleId', loadCircle);

router.get('/:circleId/overview', async (req, res) => {
  // Lazy tick: the dashboard is always correct even if the scheduler is late.
  await tickCircle(req.circle);
  const fresh = await Circle.findById(req.circle._id);
  res.json(await buildOverview(fresh, req.user));
});

router.get('/:circleId/history', async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 90);
  const tz = req.circle.timezone;
  const now = nowFor(req.circle);
  const dates = lastNDates(localDate(now, tz), days, tz);
  const docs = await Day.find({ circle: req.circle._id, date: { $gte: dates[0] } });
  const byDate = new Map(docs.map((d) => [d.date, d]));
  res.json({
    days: dates.map((date) => {
      const d = byDate.get(date);
      const ev = evaluateDay(req.circle, d, now, date);
      return { date, status: ev.status, punctuality: ev.punctuality, mood: d?.mood || null, level: d?.level || 0, checkedInAt: d?.checkedInAt || null };
    }),
  });
});

router.get('/:circleId/activity', async (req, res) => {
  const before = req.query.before ? new Date(String(req.query.before)) : null;
  const filter = { circle: req.circle._id };
  if (before && !Number.isNaN(before.getTime())) filter.createdAt = { $lt: before };
  const items = await Activity.find(filter).sort({ createdAt: -1 }).limit(30).populate('actor', 'name');
  res.json({
    items: items.map((a) => ({ id: a._id, kind: a.kind, actorType: a.actorType, actor: a.actor?.name || null, message: a.message, at: a.createdAt })),
  });
});

// ---------------------------------------------------------------- settings

const settingsSchema = z.object({
  parent: parentSchema.partial().optional(),
  schedule: scheduleSchema.optional(),
  timezone: tzSchema.optional(),
});

router.patch('/:circleId/settings', requireOwner, validate(settingsSchema), async (req, res) => {
  const { parent, schedule, timezone } = req.body;
  const c = req.circle;
  if (parent) Object.assign(c.parent, parent);
  if (schedule) c.checkIn = toCheckIn(schedule);
  if (timezone) c.timezone = timezone;
  await c.save();
  await logActivity(c._id, { actorType: 'user', actor: req.user._id, kind: 'settings', message: `${req.user.name} updated the circle settings.` });
  res.json({ circle: circleSummary(c) });
});

const pauseSchema = z.object({ until: isoDate, reason: z.string().trim().max(80).default('') });

router.post('/:circleId/pause', validate(pauseSchema), async (req, res) => {
  const c = req.circle;
  const today = localDate(nowFor(c), c.timezone);
  if (req.body.until < today) throw badRequest('Pick today or a later date.');
  const maxDate = localDate(new Date(Date.now() + 60 * 86400000), c.timezone);
  if (req.body.until > maxDate) throw badRequest('Holiday mode can be set for up to 60 days.');
  c.pausedUntil = req.body.until;
  c.pauseReason = req.body.reason;
  await c.save();
  await logActivity(c._id, {
    actorType: 'user',
    actor: req.user._id,
    kind: 'pause',
    message: `${req.user.name} paused check-in alerts until ${req.body.until}${req.body.reason ? ` (${req.body.reason})` : ''}.`,
  });
  res.json({ circle: circleSummary(c) });
});

router.delete('/:circleId/pause', async (req, res) => {
  const c = req.circle;
  c.pausedUntil = null;
  c.pauseReason = '';
  await c.save();
  await logActivity(c._id, { actorType: 'user', actor: req.user._id, kind: 'pause', message: `${req.user.name} turned check-in alerts back on.` });
  res.json({ circle: circleSummary(c) });
});

// ---------------------------------------------------------------- today

const resolveSchema = z.object({ note: z.string().trim().min(2, 'Add a short note, e.g. "Spoke to her, phone was on silent".').max(200) });

/** A family member confirms the parent is fine without the parent checking in. */
router.post('/:circleId/today/resolve', validate(resolveSchema), async (req, res) => {
  const c = req.circle;
  const now = nowFor(c);
  const date = localDate(now, c.timezone);
  const day = await getOrCreateDay(c._id, date);
  const status = evaluateDay(c, day, now).status;
  if (status === 'checked_in') throw conflict(`${c.parent.callName} has already checked in today.`);
  if (status === 'resolved') throw conflict('Someone has already marked today as OK.');

  const updated = await Day.findOneAndUpdate(
    { _id: day._id, checkedInAt: null, 'resolution.at': null },
    { $set: { resolution: { by: req.user._id, note: req.body.note, at: now } } },
    { new: true }
  );
  if (!updated) throw conflict('Today was updated by someone else. Refresh to see the latest.');

  const others = c.members.map((m) => m.user).filter((u) => u.toString() !== req.user._id.toString());
  await Promise.all([
    logActivity(c._id, { actorType: 'user', actor: req.user._id, kind: 'resolved', message: `${req.user.name} confirmed ${c.parent.callName} is OK: "${req.body.note}"` }),
    notifyUsers(others, {
      circle: c._id,
      kind: 'resolved',
      title: `${req.user.name} reached ${c.parent.callName}`,
      body: `"${req.body.note}" - no need to call.`,
    }),
  ]);
  res.json({ ok: true });
});

// ---------------------------------------------------------------- members

router.get('/:circleId/members', async (req, res) => {
  res.json({ members: await membersWithNames(req.circle, req.user._id) });
});

const meSchema = z.object({
  relation: z.string().trim().max(30).optional(),
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^[+\d\s-]*$/, 'Phone can only have digits, spaces, + and -.')
    .optional(),
});

router.patch('/:circleId/members/me', validate(meSchema), async (req, res) => {
  Object.assign(req.membership, req.body);
  await req.circle.save();
  res.json({ members: await membersWithNames(req.circle, req.user._id) });
});

const orderSchema = z.object({ order: z.array(z.string()).min(1) });

/** Owner sets who is called first, second, ... */
router.put('/:circleId/members/order', requireOwner, validate(orderSchema), async (req, res) => {
  const ids = req.body.order;
  const memberIds = req.circle.members.map((m) => m.user.toString());
  const sameSet = ids.length === memberIds.length && ids.every((id) => memberIds.includes(id)) && new Set(ids).size === ids.length;
  if (!sameSet) throw badRequest('The order must list every member exactly once.');
  for (const m of req.circle.members) m.order = ids.indexOf(m.user.toString()) + 1;
  await req.circle.save();
  res.json({ members: await membersWithNames(req.circle, req.user._id) });
});

router.delete('/:circleId/members/:userId', async (req, res) => {
  const c = req.circle;
  const target = c.memberOf(req.params.userId);
  if (!target) throw notFound('That person is not in this circle.');
  const self = req.params.userId === req.user._id.toString();
  if (!self && req.membership.role !== 'owner') throw forbidden('Only the owner can remove people.');
  if (target.role === 'owner') throw badRequest('The owner cannot be removed. Delete the circle instead.');
  c.members = c.members.filter((m) => m.user.toString() !== req.params.userId);
  await c.save();
  await logActivity(c._id, {
    actorType: 'user',
    actor: req.user._id,
    kind: 'member_left',
    message: self ? `${req.user.name} left the circle.` : `${req.user.name} removed a member from the circle.`,
  });
  res.json({ ok: true });
});

/** Owner deletes the circle and everything in it. */
router.delete('/:circleId', requireOwner, async (req, res) => {
  const id = req.circle._id;
  await Promise.all([
    Day.deleteMany({ circle: id }),
    Invite.deleteMany({ circle: id }),
    PairingCode.deleteMany({ circle: id }),
    ParentDevice.deleteMany({ circle: id }),
    Medicine.deleteMany({ circle: id }),
    DoseLog.deleteMany({ circle: id }),
    Task.deleteMany({ circle: id }),
    Activity.deleteMany({ circle: id }),
    Notification.deleteMany({ circle: id }),
  ]);
  await Circle.deleteOne({ _id: id });
  res.json({ ok: true });
});

// ---------------------------------------------------------------- invites

const inviteSchema = z.object({ relation: z.string().trim().max(30).default('') });

router.post('/:circleId/invites', requireOwner, validate(inviteSchema), async (req, res) => {
  if (req.circle.members.length >= 8) throw badRequest('A circle can have at most 8 people.');
  const token = randomToken();
  const expiresAt = new Date(Date.now() + 7 * 86400000);
  await Invite.create({ circle: req.circle._id, tokenHash: sha256(token), createdBy: req.user._id, relation: req.body.relation, expiresAt });
  res.status(201).json({ url: `${config.clientUrl.replace(/\/$/, '')}/join/${token}`, token, expiresAt });
});

// ---------------------------------------------------------------- parent phone

/** Makes a fresh 6-digit code. Older unused codes for this circle stop working. */
router.post('/:circleId/pairing-code', async (req, res) => {
  const c = req.circle;
  await PairingCode.updateMany({ circle: c._id, usedAt: null }, { $set: { expiresAt: new Date() } });
  // Retry on the (rare) chance another circle holds the same live code.
  let code;
  for (let i = 0; i < 5; i++) {
    code = sixDigitCode();
    const clash = await PairingCode.exists({ codeHash: sha256(code), usedAt: null, expiresAt: { $gt: new Date() } });
    if (!clash) break;
  }
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await PairingCode.create({ circle: c._id, codeHash: sha256(code), createdBy: req.user._id, expiresAt });
  res.status(201).json({ code, expiresAt, pairUrl: `${config.clientUrl.replace(/\/$/, '')}/p/pair?code=${code}` });
});

router.delete('/:circleId/devices/:deviceId', async (req, res) => {
  const device = await ParentDevice.findOneAndUpdate(
    { _id: req.params.deviceId, circle: req.circle._id, revokedAt: null },
    { $set: { revokedAt: new Date(), pushSubscription: null } },
    { new: true }
  ).catch(() => null);
  if (!device) throw notFound('That phone is not paired.');
  await logActivity(req.circle._id, { actorType: 'user', actor: req.user._id, kind: 'device_removed', message: `${req.user.name} unpaired "${device.label}".` });
  res.json({ ok: true });
});

// ---------------------------------------------------------------- demo clock

router.post('/:circleId/demo/fast-forward', async (req, res) => {
  const result = await fastForward(req.circle);
  res.json({ result });
});

router.post('/:circleId/demo/reset', async (req, res) => {
  await resetDemoMorning(req.circle);
  res.json({ ok: true });
});

// Medicines and the task board.
router.use('/:circleId', careRouter);

export default router;
