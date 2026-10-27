import { localDate, minutesOfDay, instantAt } from '../lib/time.js';

// The escalation ladder, as pure functions.
//
// Nothing in this file touches the database or the clock: it takes the circle
// settings, the stored day document and "now", and answers "what state is this
// day in and how far up the ladder should we be?". That keeps the rules easy to
// unit test and lets the cron job, the dashboard and the parent screen all agree.
//
//   window start ........ window end ---- +primaryAfter ---- +circleAfter
//        |  waiting       |  L1 nudge parent | L2 primary    | L3 everyone

export const LEVEL = Object.freeze({
  NONE: 0,
  NUDGE_PARENT: 1,
  PRIMARY: 2,
  CIRCLE: 3,
});

export const LEVEL_LABEL = {
  1: 'Reminded on their phone',
  2: 'Primary contact alerted',
  3: 'Whole circle alerted',
};

/** Ladder thresholds as minutes since local midnight. */
export function thresholds(checkIn) {
  return {
    [LEVEL.NUDGE_PARENT]: checkIn.windowEnd,
    [LEVEL.PRIMARY]: checkIn.windowEnd + checkIn.primaryAfter,
    [LEVEL.CIRCLE]: checkIn.windowEnd + checkIn.circleAfter,
  };
}

/** Which level should be active at `mins` minutes into the day (ignoring check-ins). */
export function levelForMinute(checkIn, mins) {
  const t = thresholds(checkIn);
  if (mins >= t[LEVEL.CIRCLE]) return LEVEL.CIRCLE;
  if (mins >= t[LEVEL.PRIMARY]) return LEVEL.PRIMARY;
  if (mins >= t[LEVEL.NUDGE_PARENT]) return LEVEL.NUDGE_PARENT;
  return LEVEL.NONE;
}

export function isPaused(circle, dateISO) {
  return Boolean(circle.pausedUntil && dateISO <= circle.pausedUntil);
}

/**
 * Evaluate one day.
 *
 * @param {object} circle  needs { timezone, checkIn, pausedUntil, createdAt }
 * @param {object|null} day  stored Day document for `date` (or null if none yet)
 * @param {Date} now
 * @param {string} [date]  local date to evaluate, defaults to today in the circle's zone
 * @returns {{ date, status, punctuality, targetLevel, level, nextStep, isToday }}
 *
 * status is one of:
 *   checked_in | resolved | paused | upcoming | waiting | overdue | missed | no_data
 */
export function evaluateDay(circle, day, now, date) {
  const tz = circle.timezone;
  const today = localDate(now, tz);
  const target = date || today;
  const isToday = target === today;
  const { checkIn } = circle;
  const level = day?.level || LEVEL.NONE;

  const base = { date: target, isToday, level, targetLevel: level, punctuality: null, nextStep: null };

  if (day?.checkedInAt) {
    const at = minutesOfDay(day.checkedInAt, tz);
    const checkedDate = localDate(day.checkedInAt, tz);
    // Late means after the window closed on that same day.
    const late = checkedDate === target && at > checkIn.windowEnd;
    return { ...base, status: 'checked_in', punctuality: late ? 'late' : 'on_time' };
  }

  if (day?.resolution?.at) return { ...base, status: 'resolved' };

  if (isPaused(circle, target)) return { ...base, status: 'paused' };

  // Days before the circle existed have no meaning.
  if (circle.createdAt && target < localDate(circle.createdAt, tz)) {
    return { ...base, status: 'no_data' };
  }

  if (target > today) return { ...base, status: 'upcoming' };
  if (target < today) return { ...base, status: 'missed' };

  const mins = minutesOfDay(now, tz);
  if (mins < checkIn.windowStart) {
    return { ...base, status: 'upcoming', nextStep: step(target, checkIn, LEVEL.NUDGE_PARENT, tz) };
  }
  if (mins < checkIn.windowEnd) {
    return { ...base, status: 'waiting', nextStep: step(target, checkIn, LEVEL.NUDGE_PARENT, tz) };
  }

  const targetLevel = Math.max(level, levelForMinute(checkIn, mins));
  const next = targetLevel < LEVEL.CIRCLE ? step(target, checkIn, targetLevel + 1, tz) : null;
  return { ...base, status: 'overdue', targetLevel, nextStep: next };
}

function step(dateISO, checkIn, lvl, tz) {
  return { level: lvl, label: LEVEL_LABEL[lvl], at: instantAt(dateISO, thresholds(checkIn)[lvl], tz) };
}

/**
 * Who gets notified when the ladder moves from `fromLevel` to `toLevel`.
 * If a cron run was late and we jump several steps at once, everyone who would
 * have been notified on the skipped steps is included, each user only once.
 *
 * @param {Array<{user}>} orderedMembers  members sorted by escalation order
 */
export function recipientsFor(orderedMembers, fromLevel, toLevel) {
  const users = new Set();
  let nudgeParent = false;
  for (let lvl = fromLevel + 1; lvl <= toLevel; lvl++) {
    if (lvl === LEVEL.NUDGE_PARENT) nudgeParent = true;
    if (lvl === LEVEL.PRIMARY && orderedMembers[0]) users.add(String(orderedMembers[0].user));
    if (lvl === LEVEL.CIRCLE) orderedMembers.forEach((m) => users.add(String(m.user)));
  }
  return { nudgeParent, users: [...users] };
}

/** Validates a check-in schedule. Returns an error message or null. */
export function validateSchedule(checkIn) {
  const { windowStart, windowEnd, primaryAfter, circleAfter } = checkIn;
  if (windowEnd - windowStart < 30) return 'The check-in window should be at least 30 minutes long.';
  if (circleAfter <= primaryAfter) return 'The whole circle should be alerted after the primary contact.';
  if (windowEnd + circleAfter > 23 * 60 + 59) return 'The last alert has to happen before midnight.';
  return null;
}
