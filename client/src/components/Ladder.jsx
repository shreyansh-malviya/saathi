import { fmtHhmm, fmtTime } from '../lib/format.js';

// The escalation ladder drawn as a train line: each station lights up as the
// morning goes on without a check-in. Used on the landing page (interactive)
// and on the dashboard (live).

export function ladderSteps(checkIn, { callName = 'Maa', primary = 'You', everyone = 'Everyone' } = {}) {
  return [
    { level: 0, at: checkIn.windowStartHhmm, title: 'Check-in window opens', body: `${callName} can tap "I'm OK" any time from now.` },
    { level: 1, at: checkIn.windowEndHhmm, title: `Gentle reminder to ${callName}`, body: 'A notification on their phone, in their language.' },
    { level: 2, at: checkIn.primaryAtHhmm, title: `${primary} ${primary === 'You' ? 'are' : 'is'} alerted`, body: 'The first person in the circle is asked to call.' },
    { level: 3, at: checkIn.circleAtHhmm, title: `${everyone} in the circle is alerted`, body: 'Siblings, a neighbour, whoever is in the circle.' },
  ];
}

/**
 * @param steps   output of ladderSteps
 * @param level   current ladder level 0-3 (0 = window open, nothing sent)
 * @param state   'calm' (nothing happening) | 'active' (climbing) | 'stopped' (checked in / resolved)
 * @param events  optional { [level]: Date } actual times each step fired
 */
export default function Ladder({ steps, level = 0, state = 'calm', events = {}, tz, compact = false }) {
  return (
    <ol className={`ladder ladder-${state} ${compact ? 'ladder-compact' : ''}`}>
      {steps.map((s) => {
        const reached = state !== 'calm' && s.level <= level;
        const fired = events[s.level];
        return (
          <li
            key={s.level}
            className={`ladder-step lv-${s.level} ${reached ? 'is-reached' : ''} ${s.level === level && state === 'active' ? 'is-current' : ''}`}
          >
            <span className="ladder-dot" aria-hidden="true" />
            <div className="ladder-text">
              <span className="ladder-time">{fired ? fmtTime(fired, tz) : fmtHhmm(s.at)}</span>
              <strong>{s.title}</strong>
              {!compact && <span className="ladder-body">{s.body}</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
