import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import Field from '../../components/Field.jsx';
import Ladder, { ladderSteps } from '../../components/Ladder.jsx';
import { post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';

const CALL_NAMES = ['Maa', 'Papa', 'Mummy', 'Nani', 'Dadi', 'Nana', 'Dada', 'Amma', 'Appa'];

const addMin = (hhmm, m) => {
  const t = Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)) + m;
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

export default function NewCircle() {
  const [step, setStep] = useState(1);
  const [parent, setParent] = useState({ name: '', callName: 'Maa', city: '', language: 'hi' });
  const [schedule, setSchedule] = useState({ windowStart: '07:00', windowEnd: '10:00', primaryAfter: 30, circleAfter: 60 });
  const [me, setMe] = useState({ relation: '', phone: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { circles } = useAuth();

  const preview = useMemo(
    () =>
      ladderSteps(
        {
          windowStartHhmm: schedule.windowStart,
          windowEndHhmm: schedule.windowEnd,
          primaryAtHhmm: addMin(schedule.windowEnd, Number(schedule.primaryAfter)),
          circleAtHhmm: addMin(schedule.windowEnd, Number(schedule.circleAfter)),
        },
        { callName: parent.callName || 'Maa' }
      ),
    [schedule, parent.callName]
  );

  function next(e) {
    e.preventDefault();
    const errs = {};
    if (parent.name.trim().length < 2) errs['parent.name'] = "Enter your parent's name.";
    if (!parent.callName.trim()) errs['parent.callName'] = 'What do you call them?';
    setErrors(errs);
    if (!Object.keys(errs).length) setStep(2);
  }

  async function create(e) {
    e.preventDefault();
    setMessage('');
    setErrors({});
    setBusy(true);
    try {
      const { circle } = await post('/circles', {
        parent,
        schedule: { ...schedule, primaryAfter: Number(schedule.primaryAfter), circleAfter: Number(schedule.circleAfter) },
        timezone: 'Asia/Kolkata',
        ...me,
      });
      await qc.invalidateQueries({ queryKey: ['me'] });
      toast.ok(`${circle.parent.callName}'s circle is ready. Now pair their phone.`);
      navigate(`/app/c/${circle.id}/circle?pair=1`);
    } catch (err) {
      setErrors(err.fields || {});
      setMessage(err.message);
      if (Object.keys(err.fields || {}).some((k) => k.startsWith('parent'))) setStep(1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wizard">
      <div className="wizard-head">
        <p className="kicker">New care circle {circles.length ? '' : '- step 1 of the whole thing'}</p>
        <h1>{step === 1 ? 'Who are we looking after?' : `When does ${parent.callName || 'Maa'} usually wake up?`}</h1>
        <div className="wizard-steps" aria-label={`Step ${step} of 2`}>
          <span className={step >= 1 ? 'is-on' : ''} />
          <span className={step >= 2 ? 'is-on' : ''} />
        </div>
      </div>

      {message && (
        <div className="alert alert-error" role="alert" style={{ marginBottom: 16 }}>
          {message}
        </div>
      )}

      {step === 1 ? (
        <form className="card wizard-card" onSubmit={next} noValidate>
          <Field label="What do you call them?" error={errors['parent.callName']}>
            <div className="chips-pick">
              {CALL_NAMES.map((n) => (
                <button
                  type="button"
                  key={n}
                  className={`pick ${parent.callName === n ? 'is-on' : ''}`}
                  onClick={() => setParent((p) => ({ ...p, callName: n }))}
                >
                  {n}
                </button>
              ))}
            </div>
            <input value={parent.callName} onChange={(e) => setParent((p) => ({ ...p, callName: e.target.value }))} maxLength={20} aria-label="Or type a name" />
          </Field>
          <div className="grid-2">
            <Field label="Their full name" error={errors['parent.name']}>
              <input value={parent.name} onChange={(e) => setParent((p) => ({ ...p, name: e.target.value }))} placeholder="Sunita Sharma" />
            </Field>
            <Field label="City" hint="So your siblings know which home this is.">
              <input value={parent.city} onChange={(e) => setParent((p) => ({ ...p, city: e.target.value }))} placeholder="Indore" />
            </Field>
          </div>
          <Field label="Language on their phone">
            <div className="seg">
              <button type="button" className={parent.language === 'hi' ? 'is-on' : ''} onClick={() => setParent((p) => ({ ...p, language: 'hi' }))}>
                <span className="hi">हिंदी</span>
              </button>
              <button type="button" className={parent.language === 'en' ? 'is-on' : ''} onClick={() => setParent((p) => ({ ...p, language: 'en' }))}>
                English
              </button>
            </div>
          </Field>
          <div className="wizard-actions">
            <span />
            <button className="btn btn-ink">Next: their morning</button>
          </div>
        </form>
      ) : (
        <form className="wizard-two" onSubmit={create} noValidate>
          <div className="card wizard-card">
            <div className="grid-2">
              <Field label="Check-in window opens">
                <input type="time" value={schedule.windowStart} onChange={(e) => setSchedule((s) => ({ ...s, windowStart: e.target.value }))} required />
              </Field>
              <Field label="Window closes">
                <input type="time" value={schedule.windowEnd} onChange={(e) => setSchedule((s) => ({ ...s, windowEnd: e.target.value }))} required />
              </Field>
            </div>
            <div className="grid-2">
              <Field label="Alert me after">
                <select value={schedule.primaryAfter} onChange={(e) => setSchedule((s) => ({ ...s, primaryAfter: e.target.value }))}>
                  {[15, 30, 45, 60].map((m) => (
                    <option key={m} value={m}>
                      {m} minutes
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Alert everyone after">
                <select value={schedule.circleAfter} onChange={(e) => setSchedule((s) => ({ ...s, circleAfter: e.target.value }))}>
                  {[30, 45, 60, 90, 120].map((m) => (
                    <option key={m} value={m}>
                      {m} minutes
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {errors.schedule && <p className="field-error">{errors.schedule}</p>}
            <hr className="divider" />
            <div className="grid-2">
              <Field label={`You are ${parent.callName || 'their'}'s...`}>
                <input value={me.relation} onChange={(e) => setMe((m) => ({ ...m, relation: e.target.value }))} placeholder="Son, Daughter, Neighbour" />
              </Field>
              <Field label="Your phone" hint={`Shown on ${parent.callName || 'their'}'s screen as a call button.`} error={errors.phone}>
                <input type="tel" value={me.phone} onChange={(e) => setMe((m) => ({ ...m, phone: e.target.value }))} placeholder="+91 98xxx xxxxx" />
              </Field>
            </div>
            <div className="wizard-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>
                Back
              </button>
              <button className="btn btn-primary" disabled={busy} aria-busy={busy || undefined}>
                {busy ? 'Creating...' : 'Create the circle'}
              </button>
            </div>
          </div>
          <aside className="card-quiet wizard-preview">
            <p className="label">What will happen on a quiet morning</p>
            <Ladder steps={preview} level={3} state="active" />
          </aside>
        </form>
      )}
    </div>
  );
}
