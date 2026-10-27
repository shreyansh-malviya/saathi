import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDay, recipientsFor, levelForMinute, validateSchedule, LEVEL } from '../src/services/ladder.js';
import { localDate, minutesOfDay, hhmmToMinutes, minutesToHhmm } from '../src/lib/time.js';

// Window 07:00 - 10:00 IST, primary at 10:30, everyone at 11:00.
const circle = {
  timezone: 'Asia/Kolkata',
  checkIn: { windowStart: 420, windowEnd: 600, primaryAfter: 30, circleAfter: 60 },
  pausedUntil: null,
  createdAt: new Date('2026-10-01T00:00:00Z'),
};

// Helper: an instant at HH:MM on 27 Oct 2026 in IST (UTC+5:30).
const ist = (hhmm, date = '2026-10-27') => new Date(`${date}T${hhmm}:00+05:30`);

describe('time helpers', () => {
  test('local date follows the circle timezone, not UTC', () => {
    // 00:30 IST on the 27th is still the 26th in UTC.
    const d = ist('00:30');
    assert.equal(d.toISOString().slice(0, 10), '2026-10-26');
    assert.equal(localDate(d, 'Asia/Kolkata'), '2026-10-27');
  });

  test('minutesOfDay and hh:mm conversions round-trip', () => {
    assert.equal(minutesOfDay(ist('08:45'), 'Asia/Kolkata'), 525);
    assert.equal(hhmmToMinutes('08:45'), 525);
    assert.equal(minutesToHhmm(525), '08:45');
    assert.throws(() => hhmmToMinutes('25:00'));
  });
});

describe('evaluateDay', () => {
  test('before the window is upcoming, with the nudge as next step', () => {
    const r = evaluateDay(circle, null, ist('06:10'));
    assert.equal(r.status, 'upcoming');
    assert.equal(r.nextStep.level, LEVEL.NUDGE_PARENT);
    assert.equal(r.nextStep.at.toISOString(), ist('10:00').toISOString());
  });

  test('inside the window is waiting', () => {
    assert.equal(evaluateDay(circle, null, ist('09:59')).status, 'waiting');
  });

  test('ladder climbs at each threshold', () => {
    assert.equal(evaluateDay(circle, null, ist('10:00')).targetLevel, LEVEL.NUDGE_PARENT);
    assert.equal(evaluateDay(circle, null, ist('10:29')).targetLevel, LEVEL.NUDGE_PARENT);
    assert.equal(evaluateDay(circle, null, ist('10:30')).targetLevel, LEVEL.PRIMARY);
    const top = evaluateDay(circle, null, ist('11:05'));
    assert.equal(top.status, 'overdue');
    assert.equal(top.targetLevel, LEVEL.CIRCLE);
    assert.equal(top.nextStep, null);
  });

  test('ladder never goes down even if settings change mid-day', () => {
    const day = { level: LEVEL.CIRCLE };
    const later = { ...circle, checkIn: { ...circle.checkIn, windowEnd: 720 } };
    assert.equal(evaluateDay(later, day, ist('11:00')).targetLevel, LEVEL.CIRCLE);
  });

  test('a check-in stops the ladder and records punctuality', () => {
    const onTime = { checkedInAt: ist('08:12'), level: 0 };
    const late = { checkedInAt: ist('10:41'), level: 2 };
    assert.deepEqual(
      [evaluateDay(circle, onTime, ist('12:00')).status, evaluateDay(circle, onTime, ist('12:00')).punctuality],
      ['checked_in', 'on_time']
    );
    const r = evaluateDay(circle, late, ist('12:00'));
    assert.equal(r.status, 'checked_in');
    assert.equal(r.punctuality, 'late');
    assert.equal(r.targetLevel, 2);
  });

  test('early check-in before the window is on time', () => {
    const early = { checkedInAt: ist('06:05') };
    assert.equal(evaluateDay(circle, early, ist('06:06')).punctuality, 'on_time');
  });

  test('family resolution stops the ladder', () => {
    const day = { level: 3, resolution: { at: ist('11:10') } };
    assert.equal(evaluateDay(circle, day, ist('11:30')).status, 'resolved');
  });

  test('past day without check-in is missed, future is upcoming', () => {
    assert.equal(evaluateDay(circle, null, ist('09:00'), '2026-10-25').status, 'missed');
    assert.equal(evaluateDay(circle, null, ist('09:00'), '2026-10-28').status, 'upcoming');
  });

  test('days before the circle existed are no_data', () => {
    assert.equal(evaluateDay(circle, null, ist('09:00'), '2026-09-20').status, 'no_data');
  });

  test('holiday mode pauses escalation', () => {
    const paused = { ...circle, pausedUntil: '2026-10-28' };
    assert.equal(evaluateDay(paused, null, ist('11:30')).status, 'paused');
    assert.equal(evaluateDay(paused, null, ist('11:30', '2026-10-29')).status, 'overdue');
  });

  test('uses local date: 23:30 UTC on the 26th is the 27th in India', () => {
    const now = new Date('2026-10-26T23:30:00Z'); // 05:00 IST on the 27th
    const r = evaluateDay(circle, null, now);
    assert.equal(r.date, '2026-10-27');
    assert.equal(r.status, 'upcoming');
  });
});

describe('recipientsFor', () => {
  const members = [{ user: 'rohan' }, { user: 'priya' }, { user: 'neighbour' }];

  test('level 1 only nudges the parent', () => {
    assert.deepEqual(recipientsFor(members, 0, 1), { nudgeParent: true, users: [] });
  });

  test('level 2 alerts the primary contact only', () => {
    assert.deepEqual(recipientsFor(members, 1, 2), { nudgeParent: false, users: ['rohan'] });
  });

  test('jumping 0 -> 3 (late cron) includes every step, no duplicates', () => {
    const r = recipientsFor(members, 0, 3);
    assert.equal(r.nudgeParent, true);
    assert.deepEqual(r.users.sort(), ['neighbour', 'priya', 'rohan']);
  });

  test('no movement means nobody is notified', () => {
    assert.deepEqual(recipientsFor(members, 3, 3), { nudgeParent: false, users: [] });
  });
});

describe('schedule validation', () => {
  test('rejects tiny windows and alerts after midnight', () => {
    assert.match(validateSchedule({ windowStart: 600, windowEnd: 610, primaryAfter: 30, circleAfter: 60 }), /30 minutes/);
    assert.match(validateSchedule({ windowStart: 1200, windowEnd: 1400, primaryAfter: 30, circleAfter: 60 }), /midnight/);
    assert.match(validateSchedule({ windowStart: 420, windowEnd: 600, primaryAfter: 60, circleAfter: 30 }), /after the primary/);
    assert.equal(validateSchedule(circle.checkIn), null);
  });

  test('levelForMinute boundaries', () => {
    assert.equal(levelForMinute(circle.checkIn, 599), 0);
    assert.equal(levelForMinute(circle.checkIn, 600), 1);
    assert.equal(levelForMinute(circle.checkIn, 660), 3);
  });
});
