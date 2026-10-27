import { Day } from '../models/Day.js';
import { User } from '../models/User.js';
import { ParentDevice } from '../models/Access.js';
import { Task, Activity } from '../models/Care.js';
import { localDate, lastNDates, minutesToHhmm } from '../lib/time.js';
import { nowFor } from '../lib/clock.js';
import { evaluateDay, thresholds, LEVEL } from './ladder.js';
import { dosesForDay, adherence } from './medicines.js';

// Shapes data for the dashboard. Kept out of the route so the route stays thin.

export async function membersWithNames(circle, meId) {
  const users = await User.find({ _id: { $in: circle.members.map((m) => m.user) } }).select('name email');
  const byId = new Map(users.map((u) => [u._id.toString(), u]));
  return circle.orderedMembers().map((m) => ({
    id: m.user.toString(),
    name: byId.get(m.user.toString())?.name || 'Former member',
    email: byId.get(m.user.toString())?.email || '',
    role: m.role,
    relation: m.relation,
    phone: m.phone,
    order: m.order,
    isMe: meId ? m.user.toString() === meId.toString() : false,
  }));
}

export function circleSummary(circle) {
  const t = thresholds(circle.checkIn);
  return {
    id: circle._id.toString(),
    parent: circle.parent,
    timezone: circle.timezone,
    isDemo: circle.isDemo,
    pausedUntil: circle.pausedUntil,
    pauseReason: circle.pauseReason,
    now: nowFor(circle),
    createdAt: circle.createdAt,
    checkIn: {
      ...circle.checkIn.toObject?.() ?? circle.checkIn,
      windowStartHhmm: minutesToHhmm(circle.checkIn.windowStart),
      windowEndHhmm: minutesToHhmm(circle.checkIn.windowEnd),
      primaryAtHhmm: minutesToHhmm(t[LEVEL.PRIMARY]),
      circleAtHhmm: minutesToHhmm(t[LEVEL.CIRCLE]),
    },
  };
}

function dayView(day, nameOf) {
  if (!day) return null;
  return {
    checkedInAt: day.checkedInAt,
    mood: day.mood,
    source: day.source,
    escalations: day.escalations.map((e) => ({
      level: e.level,
      at: e.at,
      parentNudged: e.parentNudged,
      notified: e.notified.map((id) => nameOf(id)),
    })),
    resolution: day.resolution?.at
      ? { by: nameOf(day.resolution.by), note: day.resolution.note, at: day.resolution.at }
      : null,
    helpRequests: day.helpRequests.map((h) => h.at),
  };
}

export async function buildOverview(circle, user, now = nowFor(circle)) {
  const tz = circle.timezone;
  const today = localDate(now, tz);
  const dates = lastNDates(today, 14, tz);

  const [members, days, doses, adh, devices, activity, taskCounts] = await Promise.all([
    membersWithNames(circle, user._id),
    Day.find({ circle: circle._id, date: { $gte: dates[0], $lte: today } }),
    dosesForDay(circle, now),
    adherence(circle, now, 7),
    ParentDevice.find({ circle: circle._id, revokedAt: null }).sort({ createdAt: -1 }),
    Activity.find({ circle: circle._id }).sort({ createdAt: -1 }).limit(15).populate('actor', 'name'),
    Task.aggregate([{ $match: { circle: circle._id } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
  ]);

  const nameOf = (id) => members.find((m) => m.id === String(id))?.name || 'Someone';
  const byDate = new Map(days.map((d) => [d.date, d]));
  const todayDoc = byDate.get(today) || null;
  const me = members.find((m) => m.isMe);

  return {
    circle: circleSummary(circle),
    me: { role: me?.role, relation: me?.relation, order: me?.order },
    members,
    today: { ...evaluateDay(circle, todayDoc, now), day: dayView(todayDoc, nameOf) },
    history: dates.map((date) => {
      const d = byDate.get(date) || null;
      const ev = evaluateDay(circle, d, now, date);
      return { date, status: ev.status, punctuality: ev.punctuality, mood: d?.mood || null, level: d?.level || 0 };
    }),
    medicines: { today: doses, adherence: adh },
    tasks: Object.fromEntries(['open', 'claimed', 'done'].map((s) => [s, taskCounts.find((t) => t._id === s)?.n || 0])),
    devices: devices.map((d) => ({
      id: d._id.toString(),
      label: d.label,
      lastSeenAt: d.lastSeenAt,
      pairedAt: d.createdAt,
      pushEnabled: Boolean(d.pushSubscription?.endpoint),
    })),
    activity: activity.map((a) => ({
      id: a._id.toString(),
      kind: a.kind,
      actorType: a.actorType,
      actor: a.actor?.name || null,
      message: a.message,
      at: a.createdAt,
    })),
  };
}
