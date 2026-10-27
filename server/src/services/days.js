import { Circle } from '../models/Circle.js';
import { Day } from '../models/Day.js';
import { localDate, minutesOfDay, minutesToHhmm } from '../lib/time.js';
import { formatTime } from '../lib/format.js';
import { nowFor } from '../lib/clock.js';
import { evaluateDay, recipientsFor, thresholds, LEVEL } from './ladder.js';
import { notifyUsers, notifyParent, logActivity } from './notify.js';

// Database side of the daily check-in: creating day documents, recording
// check-ins, and moving the escalation ladder forward exactly once per step.

const DUPLICATE_KEY = 11000;

/** Find or create today's Day document. Safe under concurrent calls. */
export async function getOrCreateDay(circleId, date) {
  try {
    return await Day.findOneAndUpdate(
      { circle: circleId, date },
      { $setOnInsert: { circle: circleId, date } },
      { upsert: true, new: true }
    );
  } catch (err) {
    // Two upserts racing on the unique index: the loser just reads the winner's doc.
    if (err.code === DUPLICATE_KEY) return Day.findOne({ circle: circleId, date });
    throw err;
  }
}

/**
 * Move one circle's ladder forward if it is due. Idempotent: running it twice,
 * or from two servers at once, sends each alert only once because the update is
 * conditional on the level still being lower than the target.
 */
export async function tickCircle(circle, now = nowFor(circle)) {
  const date = localDate(now, circle.timezone);
  let day = await Day.findOne({ circle: circle._id, date });
  const preview = evaluateDay(circle, day, now);
  if (preview.status !== 'overdue' || preview.targetLevel <= (day?.level || 0)) {
    return { circle: circle._id, date, status: preview.status, moved: false };
  }

  day = day || (await getOrCreateDay(circle._id, date));
  const fromLevel = day.level;
  const toLevel = preview.targetLevel;
  const ordered = circle.orderedMembers();
  const { nudgeParent, users } = recipientsFor(ordered, fromLevel, toLevel);

  const escalations = [];
  for (let lvl = fromLevel + 1; lvl <= toLevel; lvl++) {
    escalations.push({
      level: lvl,
      at: now,
      parentNudged: lvl === LEVEL.NUDGE_PARENT,
      notified:
        lvl === LEVEL.PRIMARY ? ordered.slice(0, 1).map((m) => m.user) : lvl === LEVEL.CIRCLE ? ordered.map((m) => m.user) : [],
    });
  }

  // The guard: only one caller can win this update for a given level.
  const updated = await Day.findOneAndUpdate(
    { _id: day._id, level: { $lt: toLevel }, checkedInAt: null, 'resolution.at': null },
    { $set: { level: toLevel }, $push: { escalations: { $each: escalations } } },
    { new: true }
  );
  if (!updated) return { circle: circle._id, date, status: 'overdue', moved: false };

  await sendLadderMessages(circle, { fromLevel, toLevel, nudgeParent, users, ordered });
  return { circle: circle._id, date, status: 'overdue', moved: true, fromLevel, toLevel };
}

async function sendLadderMessages(circle, { toLevel, nudgeParent, users, ordered }) {
  const name = circle.parent.callName;
  const t = thresholds(circle.checkIn);
  const closedAt = formatTime(minutesToHhmm(circle.checkIn.windowEnd));
  const jobs = [];

  if (nudgeParent) {
    const hi = circle.parent.language === 'hi';
    jobs.push(
      notifyParent(circle._id, {
        title: hi ? 'नमस्ते! आज का हाल बताइए' : 'Good morning! How are you today?',
        body: hi ? '"मैं ठीक हूँ" दबाइए, ताकि बच्चों को चिंता न हो।' : 'Tap "I\'m OK" so your family knows you are fine.',
        urgent: false,
      })
    );
    jobs.push(
      logActivity(circle._id, {
        actorType: 'system',
        kind: 'ladder_nudge',
        message: `${name}'s check-in window closed at ${closedAt}. Sent a reminder to their phone.`,
      })
    );
  }

  if (toLevel === LEVEL.PRIMARY && users.length) {
    const nextAt = formatTime(minutesToHhmm(t[LEVEL.CIRCLE]));
    jobs.push(
      notifyUsers(users, {
        circle: circle._id,
        kind: 'ladder_primary',
        severity: 'warn',
        title: `${name} hasn't checked in yet`,
        body: `The window closed at ${closedAt}. Could you give a call? If nobody marks it OK, everyone in the circle is alerted at ${nextAt}.`,
      })
    );
  }

  if (toLevel === LEVEL.CIRCLE && users.length) {
    const primaryName = ordered[0] ? 'the primary contact' : 'nobody';
    jobs.push(
      notifyUsers(users, {
        circle: circle._id,
        kind: 'ladder_circle',
        severity: 'urgent',
        title: `${name} still hasn't checked in`,
        body: `No check-in since the window closed at ${closedAt}, and ${primaryName} has not marked it OK. Please call ${name} or someone nearby.`,
      })
    );
  }

  if (toLevel >= LEVEL.PRIMARY) {
    jobs.push(
      logActivity(circle._id, {
        actorType: 'system',
        kind: 'ladder_alert',
        message:
          toLevel === LEVEL.PRIMARY
            ? `No check-in from ${name}. Alerted the primary contact.`
            : `Still no check-in from ${name}. Alerted everyone in the circle.`,
      })
    );
  }
  await Promise.all(jobs);
}

/** Run the ladder for every circle. Called by the scheduler. */
export async function tickAll() {
  const circles = await Circle.find({});
  const results = [];
  for (const c of circles) {
    try {
      results.push(await tickCircle(c));
    } catch (err) {
      // One broken circle must not stop the others from being checked.
      console.error('[tick] circle failed', c._id.toString(), err.message);
      results.push({ circle: c._id, error: err.message });
    }
  }
  return results;
}

/**
 * Record the parent's daily check-in. Idempotent: a second tap returns the
 * existing check-in with `alreadyDone: true` instead of creating a duplicate.
 */
export async function recordCheckIn(circle, { mood = 'good', source = 'parent', byUser = null, now = nowFor(circle) } = {}) {
  const date = localDate(now, circle.timezone);
  await getOrCreateDay(circle._id, date);

  const day = await Day.findOneAndUpdate(
    { circle: circle._id, date, checkedInAt: null },
    { $set: { checkedInAt: now, mood, source, checkedInBy: byUser } },
    { new: true }
  );
  if (!day) {
    return { day: await Day.findOne({ circle: circle._id, date }), alreadyDone: true };
  }

  const name = circle.parent.callName;
  const at = formatTime(minutesToHhmm(minutesOfDay(now, circle.timezone)));
  const jobs = [
    logActivity(circle._id, {
      actorType: source === 'parent' ? 'parent' : 'user',
      actor: byUser,
      kind: 'checkin',
      message: `${name} checked in at ${at}${mood === 'unwell' ? ' and is not feeling well' : mood === 'okay' ? ', feeling okay' : ', feeling good'}.`,
    }),
  ];

  // Anyone who was alerted today gets an "all clear" so they can stop worrying.
  const alerted = new Set(day.escalations.flatMap((e) => e.notified.map(String)));
  if (alerted.size) {
    jobs.push(
      notifyUsers([...alerted], {
        circle: circle._id,
        kind: 'all_clear',
        severity: 'info',
        title: `${name} checked in at ${at}`,
        body: 'All clear. No need to call any more.',
      })
    );
  }

  if (mood === 'unwell') {
    jobs.push(
      notifyUsers(
        circle.members.map((m) => m.user),
        {
          circle: circle._id,
          kind: 'unwell',
          severity: 'warn',
          title: `${name} is not feeling well today`,
          body: `${name} checked in but marked "not well". A call would help.`,
        }
      )
    );
  }
  await Promise.all(jobs);
  return { day, alreadyDone: false };
}
