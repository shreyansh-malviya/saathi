import { useState } from 'react';
import { fmtHhmm, fmtTime } from '../lib/format.js';

// The parent's phone screen. Purely presentational so it can run for real
// (pages/parent/ParentHome.jsx) and inside the phone mock on the landing page.
// Design rules: one primary action, huge targets, Hindi by default, no jargon.

export const STRINGS = {
  en: {
    namaste: 'Namaste',
    big: "I'm OK",
    bigSub: 'Tap once. Your family will know.',
    done: 'Your family knows you are OK',
    sentAt: 'Sent at',
    late: 'A little late today. Tap now so nobody worries.',
    feeling: 'How are you feeling?',
    mood: { good: 'Good', okay: 'Okay', unwell: 'Not well' },
    meds: "Today's medicines",
    take: 'Taken?',
    taken: 'Taken',
    status: { due: 'Now', upcoming: 'Later', missed: 'Missed', taken: 'Taken' },
    noMeds: 'No medicines added yet.',
    call: 'Call family',
    help: 'I need help',
    helpAsk: 'Send an alert to everyone in your family?',
    yes: 'Yes, send',
    no: 'No',
    helpSent: 'Your family has been alerted. Someone will call you.',
    food: { before_food: 'before food', after_food: 'after food', any: 'any time' },
    paused: 'Holiday mode is on. No reminders today.',
  },
  hi: {
    namaste: 'नमस्ते',
    big: 'मैं ठीक हूँ',
    bigSub: 'एक बार दबाइए, परिवार को पता चल जाएगा।',
    done: 'परिवार को पता चल गया कि आप ठीक हैं',
    sentAt: 'भेजा गया',
    late: 'आज थोड़ी देर हो गई। अभी दबा दीजिए, ताकि कोई चिंता न करे।',
    feeling: 'आज तबीयत कैसी है?',
    mood: { good: 'अच्छी', okay: 'ठीक-ठाक', unwell: 'ठीक नहीं' },
    meds: 'आज की दवाइयाँ',
    take: 'ले ली?',
    taken: 'ले ली',
    status: { due: 'अभी', upcoming: 'बाद में', missed: 'छूट गई', taken: 'ले ली' },
    noMeds: 'अभी कोई दवा नहीं जोड़ी गई।',
    call: 'परिवार को फ़ोन करें',
    help: 'मदद चाहिए',
    helpAsk: 'पूरे परिवार को खबर भेजें?',
    yes: 'हाँ, भेजें',
    no: 'नहीं',
    helpSent: 'परिवार को खबर भेज दी गई है। कोई आपको फ़ोन करेगा।',
    food: { before_food: 'खाने से पहले', after_food: 'खाने के बाद', any: 'कभी भी' },
    paused: 'छुट्टी चल रही है। आज कोई याद नहीं दिलाएगा।',
  },
};

function MoodFace({ mood }) {
  const mouth = { good: 'M9 15.5q3 3 6 0', okay: 'M9 15.5h6', unwell: 'M9 16.5q3 -3 6 0' }[mood];
  return (
    <svg viewBox="0 0 24 24" width="38" height="38" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.18" />
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="8.8" cy="10" r="1.3" fill="currentColor" />
      <circle cx="15.2" cy="10" r="1.3" fill="currentColor" />
      <path d={mouth} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function ParentScreen({
  lang = 'hi',
  onLang,
  callName,
  status,
  checkedInAt,
  mood,
  doses = [],
  family = [],
  tz,
  busy = {},
  helpSent = false,
  onCheckIn,
  onMood,
  onDose,
  onHelp,
  preview = false,
}) {
  const t = STRINGS[lang] || STRINGS.hi;
  const [askHelp, setAskHelp] = useState(false);
  const checked = status === 'checked_in' || Boolean(checkedInAt);
  const late = !checked && status === 'overdue';
  const today = new Date().toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz });

  return (
    <div className={`pscreen lang-${lang}`}>
      <header className="ps-head">
        <div>
          <div className="ps-hello">
            {t.namaste}
            {callName ? `, ${callName}` : ''}
          </div>
          <div className="ps-date">{today}</div>
        </div>
        {onLang && (
          <button className="ps-lang" onClick={() => onLang(lang === 'hi' ? 'en' : 'hi')} aria-label="Change language">
            {lang === 'hi' ? 'English' : 'हिंदी'}
          </button>
        )}
      </header>

      {status === 'paused' && !checked && <p className="ps-note">{t.paused}</p>}
      {late && <p className="ps-note ps-note-warn">{t.late}</p>}

      <section className="ps-hero">
        {!checked ? (
          <button className="ps-big" onClick={() => onCheckIn?.()} disabled={busy.checkin} aria-busy={busy.checkin || undefined}>
            <span className="ps-big-ring" aria-hidden="true" />
            <span className="ps-big-label">{t.big}</span>
            <span className="ps-big-sub">{t.bigSub}</span>
          </button>
        ) : (
          <div className="ps-done">
            <div className="ps-postmark" aria-hidden="true">
              <svg viewBox="0 0 120 120" width="120" height="120">
                <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" strokeWidth="3" />
                <circle cx="60" cy="60" r="40" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M42 61l12 12 25 -27" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="ps-done-text">{t.done}</div>
            <div className="ps-done-time">
              {t.sentAt} {fmtTime(checkedInAt || new Date(), tz)}
            </div>
            <div className="ps-feel">
              <div className="ps-feel-q">{t.feeling}</div>
              <div className="ps-moods" role="radiogroup" aria-label={t.feeling}>
                {['good', 'okay', 'unwell'].map((m) => (
                  <button
                    key={m}
                    role="radio"
                    aria-checked={mood === m}
                    className={`ps-mood mood-${m} ${mood === m ? 'is-on' : ''}`}
                    onClick={() => onMood?.(m)}
                    disabled={busy.mood}
                  >
                    <MoodFace mood={m} />
                    <span>{t.mood[m]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="ps-section">
        <h2 className="ps-h">{t.meds}</h2>
        {doses.length === 0 ? (
          <p className="ps-empty">{t.noMeds}</p>
        ) : (
          <ul className="ps-doses">
            {doses.map((d) => (
              <li key={`${d.medicineId}-${d.time}`} className={`ps-dose dose-${d.status}`}>
                <div className="ps-dose-time">{fmtHhmm(d.time)}</div>
                <div className="ps-dose-name">
                  <strong>{d.name}</strong>
                  <span>
                    {d.dose}, {t.food[d.instructions]}
                  </span>
                </div>
                {d.status === 'taken' ? (
                  <span className="ps-taken">{t.taken}</span>
                ) : (
                  <button className="ps-take" onClick={() => onDose?.(d)} disabled={busy[`dose-${d.medicineId}-${d.time}`]}>
                    {d.status === 'missed' ? t.status.missed + ' - ' + t.take : t.take}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {family.some((f) => f.phone) && (
        <section className="ps-section">
          <h2 className="ps-h">{t.call}</h2>
          <div className="ps-calls">
            {family
              .filter((f) => f.phone)
              .map((f) => (
                <a key={f.name} className="ps-call" href={preview ? undefined : `tel:${f.phone.replace(/\s/g, '')}`}>
                  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                    <path d="M6.5 3.5l3 4.2-2 2c1 2.4 3 4.4 5.4 5.4l2-2 4.2 3-1.5 3.4C11 20 4 13 3.5 6.5z" fill="currentColor" />
                  </svg>
                  <span>
                    {f.name.split(' ')[0]}
                    {f.relation ? <small> ({f.relation})</small> : null}
                  </span>
                </a>
              ))}
          </div>
        </section>
      )}

      <section className="ps-section ps-help-wrap">
        {helpSent ? (
          <p className="ps-note ps-note-ok">{t.helpSent}</p>
        ) : askHelp ? (
          <div className="ps-help-ask">
            <p>{t.helpAsk}</p>
            <div className="row" style={{ justifyContent: 'center' }}>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setAskHelp(false);
                  onHelp?.();
                }}
              >
                {t.yes}
              </button>
              <button className="btn" onClick={() => setAskHelp(false)}>
                {t.no}
              </button>
            </div>
          </div>
        ) : (
          <button className="ps-help" onClick={() => setAskHelp(true)}>
            {t.help}
          </button>
        )}
      </section>
    </div>
  );
}
