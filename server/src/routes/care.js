import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Medicine, DoseLog, Task } from '../models/Care.js';
import { validate } from '../middleware/http.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { localDate } from '../lib/time.js';
import { nowFor } from '../lib/clock.js';
import { dosesForDay } from '../services/medicines.js';
import { logActivity, notifyUsers } from '../services/notify.js';
import { membersWithNames } from '../services/overview.js';

// Mounted under /api/circles/:circleId after membership is checked,
// so req.circle and req.membership are always set here.
const router = Router({ mergeParams: true });

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time like 08:30.');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-11-02.');
const objectId = (label) => z.string().refine((v) => mongoose.isValidObjectId(v), `Invalid ${label}.`);

// ================================================================ medicines

const medicineSchema = z.object({
  name: z.string().trim().min(2, 'Enter the medicine name.').max(60),
  dose: z.string().trim().max(40).default('1 tablet'),
  times: z
    .array(hhmm)
    .min(1, 'Add at least one time.')
    .max(6, 'At most 6 times a day.')
    .transform((t) => [...new Set(t)].sort()),
  instructions: z.enum(['before_food', 'after_food', 'any']).default('after_food'),
});

function medicineView(m) {
  return { id: m._id.toString(), name: m.name, dose: m.dose, times: m.times, instructions: m.instructions, startDate: m.startDate, active: m.active };
}

router.get('/medicines', async (req, res) => {
  const meds = await Medicine.find({ circle: req.circle._id, active: true }).sort({ createdAt: 1 });
  res.json({ medicines: meds.map(medicineView), today: await dosesForDay(req.circle) });
});

router.post('/medicines', validate(medicineSchema), async (req, res) => {
  const active = await Medicine.countDocuments({ circle: req.circle._id, active: true });
  if (active >= 20) throw badRequest('That is a lot of medicines. Remove old ones before adding more.');
  const med = await Medicine.create({
    ...req.body,
    circle: req.circle._id,
    createdBy: req.user._id,
    startDate: localDate(nowFor(req.circle), req.circle.timezone),
  });
  await logActivity(req.circle._id, {
    actorType: 'user',
    actor: req.user._id,
    kind: 'medicine',
    message: `${req.user.name} added ${med.name} (${med.times.join(', ')}).`,
  });
  res.status(201).json({ medicine: medicineView(med) });
});

async function findMedicine(req) {
  if (!mongoose.isValidObjectId(req.params.medId)) throw notFound('Medicine not found.');
  const med = await Medicine.findOne({ _id: req.params.medId, circle: req.circle._id, active: true });
  if (!med) throw notFound('Medicine not found.');
  return med;
}

router.patch('/medicines/:medId', validate(medicineSchema.partial()), async (req, res) => {
  const med = await findMedicine(req);
  Object.assign(med, req.body);
  await med.save();
  res.json({ medicine: medicineView(med) });
});

// Soft delete keeps history (old dose logs) meaningful.
router.delete('/medicines/:medId', async (req, res) => {
  const med = await findMedicine(req);
  med.active = false;
  await med.save();
  await logActivity(req.circle._id, { actorType: 'user', actor: req.user._id, kind: 'medicine', message: `${req.user.name} stopped ${med.name}.` });
  res.json({ ok: true });
});

const doseSchema = z.object({ time: hhmm });

/** Family marks a dose as taken (e.g. after confirming on a call). */
router.post('/medicines/:medId/doses', validate(doseSchema), async (req, res) => {
  const med = await findMedicine(req);
  if (!med.times.includes(req.body.time)) throw badRequest(`${med.name} is not scheduled at ${req.body.time}.`);
  const date = localDate(nowFor(req.circle), req.circle.timezone);
  try {
    await DoseLog.create({ circle: req.circle._id, medicine: med._id, date, time: req.body.time, source: 'family' });
  } catch (err) {
    if (err.code !== 11000) throw err; // already marked: fine, same result
  }
  res.json({ today: await dosesForDay(req.circle) });
});

// ================================================================ tasks

const taskSchema = z.object({
  title: z.string().trim().min(3, 'Describe the task in a few words.').max(90),
  notes: z.string().trim().max(400).default(''),
  category: z.enum(['doctor', 'medicines', 'bills', 'groceries', 'repairs', 'other']).default('other'),
  dueDate: isoDate.nullable().default(null),
});

async function taskViews(circle, tasks, meId) {
  const members = await membersWithNames(circle, meId);
  const nameOf = (id) => (id ? members.find((m) => m.id === id.toString())?.name || 'Former member' : null);
  return tasks.map((t) => ({
    id: t._id.toString(),
    title: t.title,
    notes: t.notes,
    category: t.category,
    dueDate: t.dueDate,
    status: t.status,
    createdBy: nameOf(t.createdBy),
    claimedBy: nameOf(t.claimedBy),
    claimedById: t.claimedBy?.toString() || null,
    claimedAt: t.claimedAt,
    doneBy: nameOf(t.doneBy),
    doneAt: t.doneAt,
    createdAt: t.createdAt,
    canDelete: t.createdBy.toString() === meId.toString() || circle.memberOf(meId)?.role === 'owner',
  }));
}

router.get('/tasks', async (req, res) => {
  // Done tasks older than 14 days drop off the board.
  const since = new Date(Date.now() - 14 * 86400000);
  const tasks = await Task.find({
    circle: req.circle._id,
    $or: [{ status: { $ne: 'done' } }, { doneAt: { $gte: since } }],
  }).sort({ dueDate: 1, createdAt: -1 });
  res.json({ tasks: await taskViews(req.circle, tasks, req.user._id) });
});

router.post('/tasks', validate(taskSchema), async (req, res) => {
  const open = await Task.countDocuments({ circle: req.circle._id, status: { $ne: 'done' } });
  if (open >= 50) throw badRequest('The board is full. Finish or delete some tasks first.');
  const task = await Task.create({ ...req.body, circle: req.circle._id, createdBy: req.user._id });
  const others = req.circle.members.map((m) => m.user).filter((u) => u.toString() !== req.user._id.toString());
  await Promise.all([
    logActivity(req.circle._id, { actorType: 'user', actor: req.user._id, kind: 'task', message: `${req.user.name} added a task: ${task.title}.` }),
    notifyUsers(others, { circle: req.circle._id, kind: 'task_new', title: `New task for ${req.circle.parent.callName}`, body: `${req.user.name}: ${task.title}` }),
  ]);
  const [view] = await taskViews(req.circle, [task], req.user._id);
  res.status(201).json({ task: view });
});

async function findTask(req) {
  if (!mongoose.isValidObjectId(req.params.taskId)) throw notFound('Task not found.');
  const task = await Task.findOne({ _id: req.params.taskId, circle: req.circle._id });
  if (!task) throw notFound('Task not found.');
  return task;
}

/**
 * Claim is a single conditional update: only an *open* task can be claimed.
 * If two siblings tap "I'll do it" at the same moment, exactly one wins and the
 * other gets a 409 telling them who got there first.
 */
router.post('/tasks/:taskId/claim', async (req, res) => {
  const existing = await findTask(req);
  const task = await Task.findOneAndUpdate(
    { _id: existing._id, status: 'open' },
    { $set: { status: 'claimed', claimedBy: req.user._id, claimedAt: new Date() } },
    { new: true }
  );
  if (!task) {
    const current = await Task.findById(existing._id);
    if (current.claimedBy?.toString() === req.user._id.toString()) throw conflict('You have already taken this task.');
    const [view] = await taskViews(req.circle, [current], req.user._id);
    throw conflict(current.status === 'done' ? 'This task is already done.' : `${view.claimedBy} has already taken this task.`, { task: view });
  }
  await logActivity(req.circle._id, { actorType: 'user', actor: req.user._id, kind: 'task', message: `${req.user.name} will take care of: ${task.title}.` });
  const [view] = await taskViews(req.circle, [task], req.user._id);
  res.json({ task: view });
});

router.post('/tasks/:taskId/release', async (req, res) => {
  const existing = await findTask(req);
  const task = await Task.findOneAndUpdate(
    { _id: existing._id, status: 'claimed', claimedBy: req.user._id },
    { $set: { status: 'open', claimedBy: null, claimedAt: null } },
    { new: true }
  );
  if (!task) throw conflict('Only the person who took this task can hand it back.');
  await logActivity(req.circle._id, { actorType: 'user', actor: req.user._id, kind: 'task', message: `${req.user.name} handed back: ${task.title}.` });
  const [view] = await taskViews(req.circle, [task], req.user._id);
  res.json({ task: view });
});

router.post('/tasks/:taskId/complete', async (req, res) => {
  const existing = await findTask(req);
  const isOwner = req.membership.role === 'owner';
  if (existing.status === 'done') throw conflict('This task is already done.');
  if (existing.status === 'claimed' && existing.claimedBy.toString() !== req.user._id.toString() && !isOwner) {
    throw forbidden('This task was taken by someone else.');
  }
  const task = await Task.findOneAndUpdate(
    { _id: existing._id, status: { $ne: 'done' } },
    { $set: { status: 'done', doneBy: req.user._id, doneAt: new Date(), claimedBy: existing.claimedBy || req.user._id } },
    { new: true }
  );
  if (!task) throw conflict('This task is already done.');
  await logActivity(req.circle._id, { actorType: 'user', actor: req.user._id, kind: 'task_done', message: `${req.user.name} finished: ${task.title}.` });
  const [view] = await taskViews(req.circle, [task], req.user._id);
  res.json({ task: view });
});

router.delete('/tasks/:taskId', async (req, res) => {
  const task = await findTask(req);
  const allowed = task.createdBy.toString() === req.user._id.toString() || req.membership.role === 'owner';
  if (!allowed) throw forbidden('Only the person who added this task or the owner can delete it.');
  await task.deleteOne();
  res.json({ ok: true });
});

export default router;
