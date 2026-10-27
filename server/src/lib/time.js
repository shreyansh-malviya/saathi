import { DateTime } from 'luxon';

// Everything about "today" depends on where the parent lives, not on where the
// server runs (Vercel runs in UTC). These helpers always work in the circle's
// timezone.

export const DEFAULT_TZ = 'Asia/Kolkata';

/** Returns a luxon DateTime for `date` in the given zone. */
export function zoned(date, tz = DEFAULT_TZ) {
  return DateTime.fromJSDate(date instanceof Date ? date : new Date(date)).setZone(tz);
}

/** Local calendar date as YYYY-MM-DD. */
export function localDate(date, tz = DEFAULT_TZ) {
  return zoned(date, tz).toISODate();
}

/** Minutes since local midnight (0 - 1439). */
export function minutesOfDay(date, tz = DEFAULT_TZ) {
  const d = zoned(date, tz);
  return d.hour * 60 + d.minute;
}

/** "07:30" -> 450. Throws on malformed input. */
export function hhmmToMinutes(hhmm) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!match) throw new Error(`Invalid time "${hhmm}"`);
  return Number(match[1]) * 60 + Number(match[2]);
}

/** 450 -> "07:30" */
export function minutesToHhmm(mins) {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Real instant for a local date + minutes in a zone. Used to show "alert at 10:30". */
export function instantAt(dateISO, mins, tz = DEFAULT_TZ) {
  return DateTime.fromISO(dateISO, { zone: tz }).startOf('day').plus({ minutes: mins }).toJSDate();
}

/** List of the last `n` local dates ending at (and including) `endISO`, oldest first. */
export function lastNDates(endISO, n, tz = DEFAULT_TZ) {
  const end = DateTime.fromISO(endISO, { zone: tz });
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(end.minus({ days: i }).toISODate());
  return out;
}

export function isValidTimezone(tz) {
  return DateTime.local().setZone(tz).isValid;
}
