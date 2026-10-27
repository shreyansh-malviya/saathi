import { Medicine, DoseLog } from '../models/Care.js';
import { localDate, minutesOfDay, hhmmToMinutes, lastNDates } from '../lib/time.js';
import { nowFor } from '../lib/clock.js';

// A dose counts as missed if it is still not marked this long after its time.
export const MISSED_AFTER_MIN = 120;

/** Status of one dose slot at `now`. */
export function doseStatus({ taken, isToday, isPast, slotMin, nowMin }) {
  if (taken) return 'taken';
  if (isPast) return 'missed';
  if (!isToday) return 'upcoming';
  if (nowMin < slotMin) return 'upcoming';
  if (nowMin - slotMin > MISSED_AFTER_MIN) return 'missed';
  return 'due';
}

/** Today's doses for the parent screen and dashboard, sorted by time. */
export async function dosesForDay(circle, now = nowFor(circle), date) {
  const tz = circle.timezone;
  const today = localDate(now, tz);
  const target = date || today;
  const nowMin = minutesOfDay(now, tz);

  const meds = await Medicine.find({ circle: circle._id, active: true, startDate: { $lte: target } }).sort({ createdAt: 1 });
  const logs = await DoseLog.find({ circle: circle._id, date: target });
  const takenMap = new Map(logs.map((l) => [`${l.medicine}|${l.time}`, l]));

  const doses = [];
  for (const m of meds) {
    for (const time of m.times) {
      const log = takenMap.get(`${m._id}|${time}`);
      doses.push({
        medicineId: m._id.toString(),
        name: m.name,
        dose: m.dose,
        instructions: m.instructions,
        time,
        takenAt: log?.takenAt || null,
        source: log?.source || null,
        status: doseStatus({
          taken: Boolean(log),
          isToday: target === today,
          isPast: target < today,
          slotMin: hhmmToMinutes(time),
          nowMin,
        }),
      });
    }
  }
  return doses.sort((a, b) => a.time.localeCompare(b.time) || a.name.localeCompare(b.name));
}

/**
 * Adherence over the last `days` days. Only slots that are already "decided"
 * count: past days, or today's slots that are taken or past the missed cutoff.
 * Upcoming doses do not drag the percentage down.
 */
export async function adherence(circle, now = nowFor(circle), days = 7) {
  const tz = circle.timezone;
  const today = localDate(now, tz);
  const nowMin = minutesOfDay(now, tz);
  const dates = lastNDates(today, days, tz);

  const meds = await Medicine.find({ circle: circle._id, active: true });
  const logs = await DoseLog.find({ circle: circle._id, date: { $gte: dates[0], $lte: today } });
  const taken = new Set(logs.map((l) => `${l.medicine}|${l.date}|${l.time}`));

  let expected = 0;
  let done = 0;
  const byDay = dates.map((date) => {
    let e = 0;
    let t = 0;
    for (const m of meds) {
      if (m.startDate > date) continue;
      for (const time of m.times) {
        const isTaken = taken.has(`${m._id}|${date}|${time}`);
        const decided = date < today || isTaken || nowMin - hhmmToMinutes(time) > MISSED_AFTER_MIN;
        if (!decided) continue;
        e += 1;
        if (isTaken) t += 1;
      }
    }
    expected += e;
    done += t;
    return { date, expected: e, taken: t };
  });

  return { percent: expected ? Math.round((done / expected) * 100) : null, taken: done, expected, byDay };
}
