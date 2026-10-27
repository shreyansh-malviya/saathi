import bcrypt from 'bcryptjs';
import { DateTime } from 'luxon';
import { User } from '../models/User.js';
import { Circle } from '../models/Circle.js';
import { Day } from '../models/Day.js';
import { Invite, PairingCode, ParentDevice } from '../models/Access.js';
import { Medicine, DoseLog, Task, Notification, Activity } from '../models/Care.js';
import { randomToken } from '../lib/tokens.js';
import { localDate, minutesOfDay, DEFAULT_TZ } from '../lib/time.js';
import { nowFor } from '../lib/clock.js';
import { thresholds, evaluateDay } from './ladder.js';
import { tickCircle } from './days.js';
import { config } from '../config.js';
import { badRequest } from '../lib/errors.js';

// Builds a realistic, private demo: a circle for "Maa" in Indore with three
// weeks of history, so an evaluator can click around without setting anything up.
// Every demo gets its own users and is deleted after config.demoTtlHours.

const TZ = DEFAULT_TZ;
const WINDOW_START = 7 * 60;
const WINDOW_END = 10 * 60;
const DEMO_START_MIN = 8 * 60 + 40; // demo clock starts at 8:40 AM, inside the window

// Deterministic pseudo-random so every demo looks the same (and believable).
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export async function createDemo() {
  const realNow = new Date();
  const today = localDate(realNow, TZ);
  const offset = DEMO_START_MIN - minutesOfDay(realNow, TZ);
  const now = new Date(realNow.getTime() + offset * 60000);
  const rand = seeded(42);
  const tag = randomToken(6).toLowerCase().replace(/[^a-z0-9]/g, 'x');
  const passwordHash = await bcrypt.hash(randomToken(16), 10);

  const [rohan, priya, anil] = await User.create([
    { name: 'Rohan Sharma', email: `rohan.${tag}@demo.saathi.app`, passwordHash, isDemo: true },
    { name: 'Priya Sharma', email: `priya.${tag}@demo.saathi.app`, passwordHash, isDemo: true },
    { name: 'Anil Mehta', email: `anil.${tag}@demo.saathi.app`, passwordHash, isDemo: true },
  ]);

  const historyDays = 20;
  const startDate = DateTime.fromISO(today, { zone: TZ }).minus({ days: historyDays }).toISODate();

  const circle = await Circle.create({
    parent: { name: 'Sunita Sharma', callName: 'Maa', city: 'Indore', language: 'hi' },
    timezone: TZ,
    checkIn: { windowStart: WINDOW_START, windowEnd: WINDOW_END, primaryAfter: 30, circleAfter: 60 },
    members: [
      { user: rohan._id, role: 'owner', relation: 'Son', phone: '+91 98260 00000', order: 1 },
      { user: priya._id, role: 'member', relation: 'Daughter', phone: '+91 99770 00000', order: 2 },
      { user: anil._id, role: 'member', relation: 'Neighbour', phone: '+91 94250 00000', order: 3 },
    ],
    createdBy: rohan._id,
    isDemo: true,
    demoOffsetMin: offset,
  });
  // Back-date the circle so the history strip is full.
  await Circle.collection.updateOne(
    { _id: circle._id },
    { $set: { createdAt: DateTime.fromISO(startDate, { zone: TZ }).toJSDate() } }
  );

  // ---- three weeks of check-ins
  const at = (date, mins) => DateTime.fromISO(date, { zone: TZ }).startOf('day').plus({ minutes: mins }).toJSDate();
  const days = [];
  for (let i = historyDays; i >= 1; i--) {
    const date = DateTime.fromISO(today, { zone: TZ }).minus({ days: i }).toISODate();
    if (i === 13) {
      // A missed morning: phone on silent, Priya called and marked it OK.
      days.push({
        circle: circle._id,
        date,
        level: 3,
        escalations: [
          { level: 1, at: at(date, 600), parentNudged: true, notified: [] },
          { level: 2, at: at(date, 630), notified: [rohan._id] },
          { level: 3, at: at(date, 660), notified: [rohan._id, priya._id, anil._id] },
        ],
        resolution: { by: priya._id, note: 'Spoke to Maa. Phone was on silent after puja.', at: at(date, 668) },
      });
      continue;
    }
    if (i === 6) {
      // Late check-in after Rohan was alerted.
      days.push({
        circle: circle._id,
        date,
        checkedInAt: at(date, 642),
        mood: 'good',
        source: 'parent',
        level: 2,
        escalations: [
          { level: 1, at: at(date, 600), parentNudged: true, notified: [] },
          { level: 2, at: at(date, 630), notified: [rohan._id] },
        ],
      });
      continue;
    }
    const mins = 7 * 60 + 10 + Math.floor(rand() * 140); // 7:10 - 9:30
    const mood = i === 9 ? 'unwell' : rand() < 0.15 ? 'okay' : 'good';
    days.push({ circle: circle._id, date, checkedInAt: at(date, mins), mood, source: 'parent' });
  }
  await Day.insertMany(days);

  // ---- medicines and their history
  const meds = await Medicine.create([
    { circle: circle._id, name: 'Telma 40', dose: '1 tablet', times: ['08:00'], instructions: 'after_food', startDate, createdBy: rohan._id },
    { circle: circle._id, name: 'Glycomet 500', dose: '1 tablet', times: ['08:00', '20:30'], instructions: 'after_food', startDate, createdBy: priya._id },
    { circle: circle._id, name: 'Shelcal 500', dose: '1 tablet', times: ['14:00'], instructions: 'after_food', startDate, createdBy: rohan._id },
  ]);
  const doseLogs = [];
  for (let i = historyDays; i >= 1; i--) {
    const date = DateTime.fromISO(today, { zone: TZ }).minus({ days: i }).toISODate();
    for (const m of meds) {
      for (const time of m.times) {
        // Evening Glycomet gets forgotten more often - a pattern the family can spot.
        const skipChance = m.name.startsWith('Glycomet') && time === '20:30' ? 0.3 : 0.06;
        if (rand() < skipChance) continue;
        const [h, mm] = time.split(':').map(Number);
        doseLogs.push({ circle: circle._id, medicine: m._id, date, time, takenAt: at(date, h * 60 + mm + 5 + Math.floor(rand() * 40)), source: 'parent' });
      }
    }
  }
  await DoseLog.insertMany(doseLogs);

  // ---- task board
  const inDays = (n) => DateTime.fromISO(today, { zone: TZ }).plus({ days: n }).toISODate();
  await Task.create([
    { circle: circle._id, title: 'Book eye check-up at Shankara Hospital', category: 'doctor', dueDate: inDays(5), notes: 'Dr. Jain on Tuesdays. Maa prefers mornings.', createdBy: priya._id },
    { circle: circle._id, title: 'Pay MPEB electricity bill', category: 'bills', dueDate: inDays(2), createdBy: rohan._id, status: 'claimed', claimedBy: priya._id, claimedAt: now },
    { circle: circle._id, title: 'Get the geyser in the bathroom fixed', category: 'repairs', notes: 'Plumber number is in the diary near the phone.', createdBy: anil._id },
    { circle: circle._id, title: 'Refill Glycomet strips (2 weeks left)', category: 'medicines', dueDate: inDays(9), createdBy: rohan._id },
    { circle: circle._id, title: 'Buy new batteries for BP machine', category: 'groceries', createdBy: rohan._id, status: 'done', claimedBy: rohan._id, doneBy: rohan._id, doneAt: new Date(now.getTime() - 2 * 86400000) },
  ]);

  // ---- a little recent activity
  const ago = (h) => new Date(now.getTime() - h * 3600000);
  await Activity.insertMany([
    { circle: circle._id, actorType: 'user', actor: rohan._id, kind: 'circle_created', message: "Rohan Sharma started Maa's circle.", createdAt: DateTime.fromISO(startDate, { zone: TZ }).toJSDate() },
    { circle: circle._id, actorType: 'user', actor: rohan._id, kind: 'task_done', message: 'Rohan Sharma finished: Buy new batteries for BP machine.', createdAt: ago(48) },
    { circle: circle._id, actorType: 'user', actor: priya._id, kind: 'task', message: 'Priya Sharma will take care of: Pay MPEB electricity bill.', createdAt: ago(20) },
    { circle: circle._id, actorType: 'parent', kind: 'checkin', message: 'Maa checked in yesterday, feeling good.', createdAt: ago(24) },
  ]);

  await Notification.insertMany([
    { user: rohan._id, circle: circle._id, kind: 'task_new', title: 'New task for Maa', body: 'Priya Sharma: Book eye check-up at Shankara Hospital', createdAt: ago(30) },
    { user: rohan._id, circle: circle._id, kind: 'all_clear', title: 'Maa checked in at 10:42 AM', body: 'All clear. No need to call any more.', readAt: ago(140), createdAt: ago(24 * 6 - 1) },
  ]);

  return { user: rohan, circle };
}

/** Demo only: move the demo clock to just past the next ladder step and run it. */
export async function fastForward(circle) {
  if (!circle.isDemo) throw badRequest('Only demo circles have a demo clock.');
  const now = nowFor(circle);
  const date = localDate(now, circle.timezone);
  const day = await Day.findOne({ circle: circle._id, date });
  const ev = evaluateDay(circle, day, now);
  if (ev.status === 'checked_in' || ev.status === 'resolved') {
    throw badRequest('Today is already marked OK. Reset the demo morning to try the alerts again.');
  }
  if (ev.status === 'paused') throw badRequest('Holiday mode is on. Turn it off to see the alerts.');
  const next = ev.status === 'overdue' ? ev.targetLevel + 1 : 1;
  if (next > 3) throw badRequest('Everyone has already been alerted. Mark it OK or reset the demo morning.');

  const targetMin = thresholds(circle.checkIn)[next] + 1;
  const realMin = minutesOfDay(new Date(), circle.timezone);
  circle.demoOffsetMin = targetMin - realMin;
  await circle.save();
  return tickCircle(circle);
}

/** Demo only: back to 8:40 AM with no check-in today. */
export async function resetDemoMorning(circle) {
  if (!circle.isDemo) throw badRequest('Only demo circles have a demo clock.');
  circle.demoOffsetMin = DEMO_START_MIN - minutesOfDay(new Date(), circle.timezone);
  await circle.save();
  const date = localDate(nowFor(circle), circle.timezone);
  await Day.deleteOne({ circle: circle._id, date });
  await DoseLog.deleteMany({ circle: circle._id, date });
}

/** Deletes demo circles (and their users) older than the TTL. */
export async function cleanupDemos() {
  const cutoff = new Date(Date.now() - config.demoTtlHours * 3600000);
  // Demo circles are back-dated, so use the owner's account age instead.
  const oldUsers = await User.find({ isDemo: true, createdAt: { $lt: cutoff } }).select('_id');
  if (!oldUsers.length) return 0;
  const ids = oldUsers.map((u) => u._id);
  const circles = await Circle.find({ isDemo: true, 'members.user': { $in: ids } }).select('_id');
  const cids = circles.map((c) => c._id);
  await Promise.all([
    Day.deleteMany({ circle: { $in: cids } }),
    Invite.deleteMany({ circle: { $in: cids } }),
    PairingCode.deleteMany({ circle: { $in: cids } }),
    ParentDevice.deleteMany({ circle: { $in: cids } }),
    Medicine.deleteMany({ circle: { $in: cids } }),
    DoseLog.deleteMany({ circle: { $in: cids } }),
    Task.deleteMany({ circle: { $in: cids } }),
    Activity.deleteMany({ circle: { $in: cids } }),
    Notification.deleteMany({ $or: [{ circle: { $in: cids } }, { user: { $in: ids } }] }),
  ]);
  await Circle.deleteMany({ _id: { $in: cids } });
  await User.deleteMany({ _id: { $in: ids } });
  return cids.length;
}
