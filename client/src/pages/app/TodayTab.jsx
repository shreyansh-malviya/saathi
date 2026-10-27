import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Ladder, { ladderSteps } from '../../components/Ladder.jsx';
import { StampStrip, StampLegend } from '../../components/Stamps.jsx';
import Modal from '../../components/Modal.jsx';
import Field from '../../components/Field.jsx';
import { post } from '../../lib/api.js';
import { useToast } from '../../lib/toast.jsx';
import { fmtHhmm, fmtTime, fmtDay, timeAgo, MOOD } from '../../lib/format.js';

function StatusCard({ data, onResolve }) {
  const { today, circle, members } = data;
  const { parent, checkIn, timezone: tz } = circle;
  const name = parent.callName;
  const day = today.day;
  const primary = members[0];

  let tone = 'calm';
  let title;
  let body;
  if (today.status === 'checked_in') {
    tone = 'ok';
    title = `${name} checked in at ${fmtTime(day.checkedInAt, tz)}`;
    body = today.punctuality === 'late' ? 'A little later than usual, but all good.' : 'Right on time. Nothing for you to do today.';
  } else if (today.status === 'resolved') {
    tone = 'resolved';
    title = `${day.resolution.by} confirmed ${name} is OK`;
    body = `"${day.resolution.note}" at ${fmtTime(day.resolution.at, tz)}`;
  } else if (today.status === 'overdue') {
    tone = 'alert';
    title = `${name} hasn't checked in yet`;
    body =
      today.targetLevel >= 3
        ? `Everyone in the circle has been alerted. Please call ${name} or someone nearby, then mark it OK here.`
        : today.targetLevel === 2
          ? `${primary?.isMe ? 'You are' : `${primary?.name} is`} being asked to call. If nobody marks it OK, everyone is alerted at ${fmtHhmm(checkIn.circleAtHhmm)}.`
          : `The window closed at ${fmtHhmm(checkIn.windowEndHhmm)}. A reminder went to ${name}'s phone.`;
  } else if (today.status === 'waiting') {
    title = `Waiting for ${name}'s hello`;
    body = `The window is open until ${fmtHhmm(checkIn.windowEndHhmm)}. Nobody is alerted before then.`;
  } else if (today.status === 'paused') {
    tone = 'paused';
    title = 'Holiday mode is on';
    body = `No reminders or alerts until ${fmtDay(circle.pausedUntil)}${circle.pauseReason ? ` (${circle.pauseReason})` : ''}.`;
  } else {
    title = `${name}'s window opens at ${fmtHhmm(checkIn.windowStartHhmm)}`;
    body = 'Enjoy your morning. We will tell you if anything needs you.';
  }

  return (
    <section className={`status card status-${tone}`}>
      <div className="status-mark" aria-hidden="true">
        {tone === 'ok' && (
          <svg viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="28" />
            <path d="M20 33l8 8 17-18" />
          </svg>
        )}
        {tone === 'alert' && (
          <svg viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="28" />
            <path d="M32 18v18M32 45v1" />
          </svg>
        )}
        {tone === 'resolved' && (
          <svg viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="28" />
            <path d="M24 18l5 7-3.5 3.5c1.8 4 5 7.2 9 9l3.5-3.5 7 5-3 6c-12 1-25-12-25-25z" fill="currentColor" stroke="none" />
          </svg>
        )}
        {(tone === 'calm' || tone === 'paused') && (
          <svg viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="28" />
            <path d="M32 18v15l9 6" />
          </svg>
        )}
      </div>
      <div className="status-text">
        <h2>{title}</h2>
        <p>{body}</p>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          {day?.mood && today.status === 'checked_in' && <span className={`chip chip-${MOOD[day.mood].tone}`}>{MOOD[day.mood].en}</span>}
          {today.status === 'checked_in' && day?.source === 'parent' && <span className="chip chip-ink">From {name}'s phone</span>}
          {today.nextStep && today.status !== 'checked_in' && (
            <span className="chip chip-ink">
              Next: {today.nextStep.label.toLowerCase()} at {fmtTime(today.nextStep.at, circle.timezone)}
            </span>
          )}
        </div>
        {(today.status === 'overdue' || today.status === 'waiting') && (
          <div className="row" style={{ marginTop: 14, flexWrap: 'wrap' }}>
            <button className={`btn ${today.status === 'overdue' ? 'btn-primary' : ''}`} onClick={onResolve}>
              I spoke to {name}, all OK
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function DemoClock({ data }) {
  const qc = useQueryClient();
  const toast = useToast();
  const id = data.circle.id;
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['overview', id] });
    qc.invalidateQueries({ queryKey: ['notifications'] });
  };
  const ff = useMutation({
    mutationFn: () => post(`/circles/${id}/demo/fast-forward`),
    onSuccess: (r) => {
      refresh();
      const lvl = r.result?.toLevel;
      toast.info(lvl === 1 ? "Window closed. Maa's phone got a reminder." : lvl === 2 ? 'You (Rohan) were alerted. Check the bell.' : 'Everyone in the circle was alerted.');
    },
    onError: (e) => toast.error(e),
  });
  const reset = useMutation({
    mutationFn: () => post(`/circles/${id}/demo/reset`),
    onSuccess: () => {
      refresh();
      toast.ok('Back to 8:40 AM. No check-in yet.');
    },
    onError: (e) => toast.error(e),
  });
  const openPhone = useMutation({
    mutationFn: () => post(`/circles/${id}/pairing-code`),
    onSuccess: (r) => window.open(`/p/pair?code=${r.code}`, '_blank', 'noopener'),
    onError: (e) => toast.error(e),
  });
  return (
    <div className="democlock">
      <div className="democlock-time">
        <span className="tiny">Demo clock in {data.circle.parent.city}</span>
        <strong>{fmtTime(data.circle.now, data.circle.timezone)}</strong>
      </div>
      <div className="democlock-actions">
        <button className="btn btn-sm btn-leaf" onClick={() => openPhone.mutate()} disabled={openPhone.isPending}>
          Open Maa's phone
        </button>
        <button className="btn btn-sm" onClick={() => ff.mutate()} disabled={ff.isPending}>
          {ff.isPending ? 'Moving clock...' : 'Skip to next alert'}
        </button>
        <button className="btn btn-sm btn-ghost" onClick={() => reset.mutate()} disabled={reset.isPending}>
          Reset morning
        </button>
      </div>
    </div>
  );
}

function ResolveModal({ data, onClose }) {
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const qc = useQueryClient();
  const toast = useToast();
  const m = useMutation({
    mutationFn: () => post(`/circles/${data.circle.id}/today/resolve`, { note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['overview', data.circle.id] });
      toast.ok('Marked OK. Everyone else was told they can stop worrying.');
      onClose();
    },
    onError: (e) => setErr(e.fields?.note || e.message),
  });
  return (
    <Modal title={`Is ${data.circle.parent.callName} OK?`} onClose={onClose}>
      <p className="muted">This stops the alerts for today and tells everyone in the circle who reached {data.circle.parent.callName}.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
      >
        <Field label="What happened?" error={err}>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Spoke to her. Phone was on silent after puja." maxLength={200} />
        </Field>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-leaf" disabled={m.isPending}>
            {m.isPending ? 'Saving...' : 'Yes, all OK'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function TodayTab({ data }) {
  const [resolving, setResolving] = useState(false);
  const [params, setParams] = useSearchParams();
  const { circle, today, members, medicines, history, activity } = data;
  const tz = circle.timezone;
  const name = circle.parent.callName;
  const primary = members[0];
  const steps = ladderSteps(circle.checkIn, { callName: name, primary: primary?.isMe ? 'You' : primary?.name.split(' ')[0] || 'First contact' });
  const events = Object.fromEntries((today.day?.escalations || []).map((e) => [e.level, e.at]));
  const ladderState = today.status === 'overdue' ? 'active' : today.status === 'checked_in' || today.status === 'resolved' ? (today.level > 0 ? 'stopped' : 'calm') : 'calm';
  const helps = today.day?.helpRequests || [];
  const dueDoses = medicines.today.filter((d) => d.status !== 'taken');

  return (
    <div className="today">
      {params.get('welcome') === 'demo' && (
        <div className="welcome card tape">
          <div>
            <h3>Hi Rohan. This is your Maa's circle.</h3>
            <p>
              Maa lives in Indore and you're in Bengaluru. It's 8:40 AM on the demo clock and she hasn't tapped yet. Try this: open Maa's phone in a new tab and
              tap the big green button, then come back here. Or skip ahead and watch the alerts climb.
            </p>
          </div>
          <button
            className="btn btn-sm"
            onClick={() => {
              params.delete('welcome');
              setParams(params, { replace: true });
            }}
          >
            Got it
          </button>
        </div>
      )}
      {circle.isDemo && <DemoClock data={data} />}
      {helps.length > 0 && (
        <div className="alert alert-error" role="alert">
          {name} pressed "I need help" at {fmtTime(helps[helps.length - 1], tz)}. Please call now.
        </div>
      )}

      <div className="dash-grid">
        <div className="col">
          <StatusCard data={data} onResolve={() => setResolving(true)} />
          <section className="card">
            <div className="card-head">
              <h3>Last two weeks</h3>
              <Link to="../circle" relative="path" className="tiny">
                Holiday mode
              </Link>
            </div>
            <StampStrip days={history} tz={tz} />
            <StampLegend />
          </section>
          <section className="card">
            <div className="card-head">
              <h3>Recent activity</h3>
            </div>
            {activity.length === 0 ? (
              <div className="empty">
                <span className="hand">Nothing has happened yet.</span>
              </div>
            ) : (
              <ul className="feed">
                {activity.map((a) => (
                  <li key={a.id} className={`feed-item feed-${a.actorType} feed-${a.kind}`}>
                    <span className="feed-dot" aria-hidden="true" />
                    <span className="feed-msg">{a.message}</span>
                    <time className="feed-time">{timeAgo(a.at)}</time>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <div className="col">
          <section className="card">
            <div className="card-head">
              <h3>Today's ladder</h3>
              <span className="chip chip-inland">Level {today.status === 'overdue' ? today.targetLevel : today.level} of 3</span>
            </div>
            <Ladder steps={steps} level={today.status === 'overdue' ? today.targetLevel : today.level} state={ladderState} events={events} tz={tz} />
            {today.day?.escalations?.some((e) => e.notified.length) && (
              <p className="tiny muted">
                Alerted today:{' '}
                {[...new Set(today.day.escalations.flatMap((e) => e.notified))].join(', ')}
              </p>
            )}
          </section>
          <section className="card">
            <div className="card-head">
              <h3>Medicines today</h3>
              {medicines.adherence.percent !== null && (
                <span className={`chip ${medicines.adherence.percent >= 85 ? 'chip-leaf' : medicines.adherence.percent >= 60 ? 'chip-marigold' : 'chip-postbox'}`}>
                  {medicines.adherence.percent}% this week
                </span>
              )}
            </div>
            {medicines.today.length === 0 ? (
              <div className="empty">
                <span className="hand">No medicines added.</span>
                <Link to="../medicines" relative="path" className="btn btn-sm">
                  Add a medicine
                </Link>
              </div>
            ) : (
              <ul className="dose-list">
                {medicines.today.map((d) => (
                  <li key={`${d.medicineId}-${d.time}`} className={`dose-row dose-${d.status}`}>
                    <span className="dose-time">{fmtHhmm(d.time)}</span>
                    <span className="dose-name">{d.name}</span>
                    <span className={`chip ${d.status === 'taken' ? 'chip-leaf' : d.status === 'missed' ? 'chip-postbox' : d.status === 'due' ? 'chip-marigold' : 'chip-ink'}`}>
                      {d.status === 'taken' ? `Taken ${fmtTime(d.takenAt, tz)}` : d.status === 'due' ? 'Due now' : d.status === 'missed' ? 'Missed' : 'Later'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {dueDoses.length > 0 && medicines.today.length > 0 && (
              <Link to="../medicines" relative="path" className="tiny">
                Mark a dose taken after a call
              </Link>
            )}
          </section>
          <section className="card who-card">
            <div className="card-head">
              <h3>Who gets called, in order</h3>
            </div>
            <ol className="order-list">
              {members.map((m) => (
                <li key={m.id}>
                  <span className="order-no">{m.order}</span>
                  <span>
                    <strong>{m.isMe ? 'You' : m.name}</strong>
                    {m.relation && <span className="muted"> - {m.relation}</span>}
                  </span>
                  {m.phone && !m.isMe && (
                    <a className="btn btn-sm btn-ghost" href={`tel:${m.phone.replace(/\s/g, '')}`}>
                      Call
                    </a>
                  )}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
      {resolving && <ResolveModal data={data} onClose={() => setResolving(false)} />}
    </div>
  );
}
