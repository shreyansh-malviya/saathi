import { fmtDay, fmtTime } from '../lib/format.js';

// One postage stamp per day. Colour and mark tell the story at a glance:
// green tick = checked in on time, marigold = late, blue phone = family confirmed,
// red cross = missed, pale = holiday or before the circle existed.

const META = {
  on_time: { cls: 'st-leaf', label: 'Checked in' },
  late: { cls: 'st-marigold', label: 'Checked in late' },
  resolved: { cls: 'st-inland', label: 'Family confirmed OK' },
  missed: { cls: 'st-postbox', label: 'Missed' },
  paused: { cls: 'st-paper', label: 'Holiday mode' },
  no_data: { cls: 'st-blank', label: 'Before Saathi' },
  waiting: { cls: 'st-today', label: 'Waiting' },
  upcoming: { cls: 'st-today', label: 'Not yet' },
  overdue: { cls: 'st-overdue', label: 'Overdue' },
};

export function stampKey(day) {
  if (day.status === 'checked_in') return day.punctuality === 'late' ? 'late' : 'on_time';
  return day.status;
}

function Mark({ k }) {
  if (k === 'on_time' || k === 'late')
    return <path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />;
  if (k === 'resolved')
    return <path d="M8.5 5.5l2 3-1.5 1.5c.8 1.8 2.2 3.2 4 4l1.5-1.5 3 2-1.2 2.6c-5 .4-10.3-4.9-10.4-10.4z" fill="currentColor" />;
  if (k === 'missed') return <path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />;
  if (k === 'paused')
    return <path d="M6 15h12M8 15c0-4 1.5-7 4-7s4 3 4 7M12 8V5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />;
  if (k === 'overdue') return <path d="M12 6v7M12 17v.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />;
  if (k === 'waiting' || k === 'upcoming') return <circle cx="12" cy="12" r="3" fill="currentColor" />;
  return null;
}

export function DayStamp({ day, tz, size = 'md', showDate = true }) {
  const k = stampKey(day);
  const meta = META[k] || META.no_data;
  const title = `${fmtDay(day.date)}: ${meta.label}${day.checkedInAt ? ` at ${fmtTime(day.checkedInAt, tz)}` : ''}${
    day.mood === 'unwell' ? ' (not feeling well)' : ''
  }`;
  return (
    <div className={`daystamp ${meta.cls} ds-${size}`} title={title} aria-label={title}>
      <div className="ds-inner">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <Mark k={k} />
        </svg>
        {showDate && <span className="ds-date">{Number(day.date.slice(8))}</span>}
      </div>
      {day.mood === 'unwell' && <span className="ds-dot" aria-hidden="true" />}
    </div>
  );
}

export function StampStrip({ days, tz, size }) {
  return (
    <div className="stampstrip">
      {days.map((d) => (
        <div key={d.date} className="stampstrip-cell">
          <DayStamp day={d} tz={tz} size={size} />
          <span className="stampstrip-dow">{fmtDay(d.date, { weekday: 'narrow' })}</span>
        </div>
      ))}
    </div>
  );
}

export function StampLegend() {
  const items = [
    ['on_time', 'On time'],
    ['late', 'Late'],
    ['resolved', 'Family confirmed'],
    ['missed', 'Missed'],
    ['paused', 'Holiday'],
  ];
  return (
    <div className="stamp-legend">
      {items.map(([k, label]) => (
        <span key={k} className="stamp-legend-item">
          <DayStamp
            day={{ date: '2026-01-01', status: k === 'on_time' || k === 'late' ? 'checked_in' : k, punctuality: k === 'late' ? 'late' : 'on_time' }}
            size="xs"
            showDate={false}
          />
          {label}
        </span>
      ))}
    </div>
  );
}
