// Formatting helpers. Times are shown in the circle's timezone (usually IST).

export function fmtTime(date, tz = 'Asia/Kolkata') {
  if (!date) return '';
  return new Date(date).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz }).toUpperCase();
}

/** "14:05" -> "2:05 PM" */
export function fmtHhmm(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export function fmtDay(iso, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  if (!iso) return '';
  const d = typeof iso === 'string' && iso.length === 10 ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return d.toLocaleDateString('en-IN', opts);
}

export function timeAgo(date) {
  const s = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} day${d > 1 ? 's' : ''} ago`;
  return fmtDay(date, { day: 'numeric', month: 'short' });
}

export const MOOD = {
  good: { en: 'Feeling good', hi: 'अच्छा', tone: 'leaf' },
  okay: { en: 'Feeling okay', hi: 'ठीक-ठाक', tone: 'marigold' },
  unwell: { en: 'Not feeling well', hi: 'तबीयत ठीक नहीं', tone: 'postbox' },
};

export const CATEGORY = {
  doctor: 'Doctor',
  medicines: 'Medicines',
  bills: 'Bills',
  groceries: 'Groceries',
  repairs: 'Repairs',
  other: 'Other',
};

export const INSTRUCTIONS = { before_food: 'Before food', after_food: 'After food', any: 'Any time' };
