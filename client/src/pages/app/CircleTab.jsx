import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import Modal from '../../components/Modal.jsx';
import Field from '../../components/Field.jsx';
import { post, patch, put, del } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import { enablePush, pushPermission } from '../../lib/push.js';
import { timeAgo, fmtDay } from '../../lib/format.js';

function useRefresh(circleId) {
  const qc = useQueryClient();
  return useCallback(() => {
    qc.invalidateQueries({ queryKey: ['overview', circleId] });
    qc.invalidateQueries({ queryKey: ['me'] });
  }, [qc, circleId]);
}

// ------------------------------------------------------------------ pairing

function Countdown({ until, onExpire }) {
  const [left, setLeft] = useState(() => new Date(until) - Date.now());
  useEffect(() => {
    const id = setInterval(() => {
      const l = new Date(until) - Date.now();
      setLeft(l);
      if (l <= 0) {
        clearInterval(id);
        onExpire();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [until, onExpire]);
  const s = Math.max(0, Math.round(left / 1000));
  return (
    <span>
      {Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}
    </span>
  );
}

function PairModal({ circle, onClose }) {
  const [code, setCode] = useState(null);
  const toast = useToast();
  const refresh = useRefresh(circle.id);
  const gen = useMutation({
    mutationFn: () => post(`/circles/${circle.id}/pairing-code`),
    onSuccess: setCode,
    onError: (e) => toast.error(e),
  });
  useEffect(() => {
    gen.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Poll for the new phone so the modal can say "paired!" by itself.
  useEffect(() => {
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [refresh]);

  const pretty = code?.code ? `${code.code.slice(0, 3)} ${code.code.slice(3)}` : '';
  const pairUrl = code ? `${window.location.origin}/p/pair?code=${code.code}` : '';
  return (
    <Modal title={`Pair ${circle.parent.callName}'s phone`} onClose={onClose} wide>
      {gen.isPending && <div className="skeleton" style={{ height: 200 }} />}
      {gen.isError && <div className="alert alert-error">{gen.error.message}</div>}
      {code && (
        <div className="pair">
          <div className="pair-code-side">
            <ol className="pair-steps">
              <li>
                On {circle.parent.callName}'s phone, open <strong>{window.location.host}/p</strong>
              </li>
              <li>Type this code (or scan the QR with the phone camera):</li>
            </ol>
            <div className="pair-code" aria-label={`Pairing code ${code.code}`}>
              {pretty}
            </div>
            <p className="tiny muted">
              Works once. Expires in <Countdown until={code.expiresAt} onExpire={() => setCode(null)} />.{' '}
              <button className="link-btn" onClick={() => gen.mutate()}>
                New code
              </button>
            </p>
            <ol className="pair-steps" start={3}>
              <li>Then tap "Add to Home Screen" so it opens like an app. That's it.</li>
            </ol>
          </div>
          <div className="pair-qr">
            <QRCodeSVG value={pairUrl} size={176} fgColor="#1d2747" bgColor="#fbf6ec" level="M" />
            <a className="tiny" href={pairUrl} target="_blank" rel="noreferrer">
              Open on this device instead
            </a>
          </div>
        </div>
      )}
      {!code && !gen.isPending && !gen.isError && (
        <div className="empty">
          <span>The code expired.</span>
          <button className="btn btn-sm" onClick={() => gen.mutate()}>
            Get a new code
          </button>
        </div>
      )}
    </Modal>
  );
}

// ------------------------------------------------------------------ invite

function InviteModal({ circle, onClose }) {
  const [relation, setRelation] = useState('');
  const [link, setLink] = useState(null);
  const toast = useToast();
  const m = useMutation({
    mutationFn: () => post(`/circles/${circle.id}/invites`, { relation }),
    onSuccess: (r) => setLink({ ...r, url: `${window.location.origin}/join/${r.token}` }),
    onError: (e) => toast.error(e),
  });
  const message = link
    ? `I've set up Saathi for ${circle.parent.callName}. It tells us if ${circle.parent.callName} doesn't check in in the morning. Join the circle here: ${link.url}`
    : '';
  return (
    <Modal title="Invite someone to the circle" onClose={onClose}>
      {!link ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
        >
          <p className="muted">A sibling, a cousin in the same city, a neighbour. Each link works for one person and expires in 7 days.</p>
          <Field label={`Their relation to ${circle.parent.callName} (optional)`}>
            <input value={relation} onChange={(e) => setRelation(e.target.value)} placeholder="Daughter, Neighbour" maxLength={30} />
          </Field>
          <button className="btn btn-primary" disabled={m.isPending}>
            {m.isPending ? 'Creating link...' : 'Create invite link'}
          </button>
        </form>
      ) : (
        <div>
          <p className="muted">Send this link. They'll make an account and land straight in the circle.</p>
          <div className="copy-row">
            <input className="input" readOnly value={link.url} onFocus={(e) => e.target.select()} />
            <button
              className="btn btn-sm"
              onClick={() => navigator.clipboard?.writeText(link.url).then(() => toast.ok('Link copied.'), () => toast.error('Could not copy. Select and copy it instead.'))}
            >
              Copy
            </button>
          </div>
          <a className="btn btn-leaf" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" style={{ marginTop: 12 }}>
            Share on WhatsApp
          </a>
          <p className="tiny muted" style={{ marginTop: 10 }}>
            Expires {fmtDay(link.expiresAt, { day: 'numeric', month: 'short' })}.
          </p>
        </div>
      )}
    </Modal>
  );
}

// ------------------------------------------------------------------ main

export default function CircleTab({ data }) {
  const { circle, members, devices, me } = data;
  const isOwner = me.role === 'owner';
  const [params, setParams] = useSearchParams();
  const [pairing, setPairing] = useState(params.get('pair') === '1');
  const [inviting, setInviting] = useState(false);
  const refresh = useRefresh(circle.id);
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  const closePair = () => {
    setPairing(false);
    if (params.get('pair')) {
      params.delete('pair');
      setParams(params, { replace: true });
    }
  };

  const unpair = useMutation({
    mutationFn: (d) => del(`/circles/${circle.id}/devices/${d.id}`),
    onSuccess: () => {
      refresh();
      toast.ok('Phone unpaired. It will need a new code to work again.');
    },
    onError: (e) => toast.error(e),
  });

  const order = useMutation({
    mutationFn: (ids) => put(`/circles/${circle.id}/members/order`, { order: ids }),
    onSuccess: refresh,
    onError: (e) => toast.error(e),
  });
  const move = (i, dir) => {
    const ids = members.map((m) => m.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    order.mutate(ids);
  };

  const remove = useMutation({
    mutationFn: (m) => del(`/circles/${circle.id}/members/${m.id}`),
    onSuccess: (_r, m) => {
      refresh();
      if (m.isMe) navigate('/app');
      toast.ok(m.isMe ? 'You left the circle.' : `${m.name} was removed.`);
    },
    onError: (e) => toast.error(e),
  });

  // schedule + parent
  const [sched, setSched] = useState({
    windowStart: circle.checkIn.windowStartHhmm,
    windowEnd: circle.checkIn.windowEndHhmm,
    primaryAfter: circle.checkIn.primaryAfter,
    circleAfter: circle.checkIn.circleAfter,
  });
  const [parent, setParent] = useState({ name: circle.parent.name, callName: circle.parent.callName, city: circle.parent.city, language: circle.parent.language });
  const [settingsErr, setSettingsErr] = useState('');
  const saveSettings = useMutation({
    mutationFn: () => patch(`/circles/${circle.id}/settings`, { parent, schedule: { ...sched, primaryAfter: Number(sched.primaryAfter), circleAfter: Number(sched.circleAfter) } }),
    onSuccess: () => {
      setSettingsErr('');
      refresh();
      toast.ok('Saved. The new times apply from now.');
    },
    onError: (e) => setSettingsErr(e.message),
  });

  // holiday
  const [pause, setPause] = useState({ until: '', reason: '' });
  const setHoliday = useMutation({
    mutationFn: () => post(`/circles/${circle.id}/pause`, pause),
    onSuccess: () => {
      refresh();
      toast.ok('Holiday mode on.');
    },
    onError: (e) => toast.error(e),
  });
  const endHoliday = useMutation({
    mutationFn: () => del(`/circles/${circle.id}/pause`),
    onSuccess: () => {
      refresh();
      toast.ok('Alerts are back on.');
    },
    onError: (e) => toast.error(e),
  });

  // my details
  const mine = members.find((m) => m.isMe);
  const [myInfo, setMyInfo] = useState({ relation: mine?.relation || '', phone: mine?.phone || '' });
  const saveMe = useMutation({
    mutationFn: () => patch(`/circles/${circle.id}/members/me`, myInfo),
    onSuccess: () => {
      refresh();
      toast.ok('Your details were saved.');
    },
    onError: (e) => toast.error(e),
  });

  const [perm, setPerm] = useState(pushPermission());
  const push = useMutation({
    mutationFn: () => enablePush('user'),
    onSuccess: () => {
      setPerm('granted');
      toast.ok('Alerts will now pop up on this device.');
    },
    onError: (e) => toast.error(e),
  });

  const deleteCircle = useMutation({
    mutationFn: () => del(`/circles/${circle.id}`),
    onSuccess: () => {
      refresh();
      navigate('/app');
      toast.ok('Circle deleted.');
    },
    onError: (e) => toast.error(e),
  });

  return (
    <div className="dash-grid">
      <div className="col">
        <section className="card">
          <div className="card-head">
            <h3>{circle.parent.callName}'s phone</h3>
            <button className="btn btn-sm btn-primary" onClick={() => setPairing(true)}>
              {devices.length ? 'Pair another' : 'Pair the phone'}
            </button>
          </div>
          {devices.length === 0 ? (
            <div className="empty">
              <span className="hand">No phone paired yet.</span>
              <span className="tiny">Pair it once with a 6-digit code. No password, no OTP.</span>
            </div>
          ) : (
            <ul className="device-list">
              {devices.map((d) => (
                <li key={d.id}>
                  <div>
                    <strong>{d.label}</strong>
                    <span className="tiny muted">
                      Paired {timeAgo(d.pairedAt)} - last opened {timeAgo(d.lastSeenAt)}
                    </span>
                  </div>
                  <div className="row">
                    <span className={`chip ${d.pushEnabled ? 'chip-leaf' : 'chip-ink'}`}>{d.pushEnabled ? 'Reminders on' : 'Reminders off'}</span>
                    <button className="btn btn-sm btn-ghost" onClick={() => window.confirm(`Unpair ${d.label}?`) && unpair.mutate(d)}>
                      Unpair
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h3>People, in calling order</h3>
            {isOwner && (
              <button className="btn btn-sm" onClick={() => setInviting(true)}>
                Invite someone
              </button>
            )}
          </div>
          <p className="tiny muted">Number 1 is alerted first. Everyone is alerted if nobody marks it OK.</p>
          <ol className="member-list">
            {members.map((m, i) => (
              <li key={m.id}>
                <span className="order-no">{i + 1}</span>
                <div className="member-info">
                  <strong>
                    {m.name}
                    {m.isMe ? ' (you)' : ''}
                  </strong>
                  <span className="tiny muted">
                    {[m.relation, m.role === 'owner' ? 'Owner' : null, m.phone].filter(Boolean).join(' - ') || m.email}
                  </span>
                </div>
                <div className="row member-actions">
                  {isOwner && (
                    <>
                      <button className="btn btn-sm btn-ghost" onClick={() => move(i, -1)} disabled={i === 0 || order.isPending} aria-label={`Move ${m.name} up`}>
                        Up
                      </button>
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => move(i, 1)}
                        disabled={i === members.length - 1 || order.isPending}
                        aria-label={`Move ${m.name} down`}
                      >
                        Down
                      </button>
                    </>
                  )}
                  {m.role !== 'owner' && (isOwner || m.isMe) && (
                    <button className="btn btn-sm btn-ghost" onClick={() => window.confirm(m.isMe ? 'Leave this circle?' : `Remove ${m.name}?`) && remove.mutate(m)}>
                      {m.isMe ? 'Leave' : 'Remove'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="card">
          <div className="card-head">
            <h3>You</h3>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMe.mutate();
            }}
          >
            <div className="grid-2">
              <Field label={`Your relation to ${circle.parent.callName}`}>
                <input value={myInfo.relation} onChange={(e) => setMyInfo({ ...myInfo, relation: e.target.value })} maxLength={30} />
              </Field>
              <Field label="Your phone" hint={`Shown as a call button on ${circle.parent.callName}'s screen.`}>
                <input type="tel" value={myInfo.phone} onChange={(e) => setMyInfo({ ...myInfo, phone: e.target.value })} maxLength={20} />
              </Field>
            </div>
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <button className="btn btn-sm" disabled={saveMe.isPending}>
                Save my details
              </button>
              {perm === 'granted' ? (
                <span className="chip chip-leaf">Alerts pop up on this device</span>
              ) : perm === 'unsupported' ? (
                <span className="tiny muted">This browser can't show pop-up alerts. You'll still see them in the bell.</span>
              ) : (
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => push.mutate()} disabled={push.isPending}>
                  Turn on pop-up alerts here
                </button>
              )}
            </div>
          </form>
        </section>
      </div>

      <div className="col">
        <section className="card">
          <div className="card-head">
            <h3>Morning and alerts</h3>
            {!isOwner && <span className="chip chip-ink">Only {members.find((m) => m.role === 'owner')?.name} can change this</span>}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveSettings.mutate();
            }}
          >
            <fieldset disabled={!isOwner} className="plain">
              <div className="grid-2">
                <Field label="Name">
                  <input value={parent.name} onChange={(e) => setParent({ ...parent, name: e.target.value })} />
                </Field>
                <Field label="Called">
                  <input value={parent.callName} onChange={(e) => setParent({ ...parent, callName: e.target.value })} maxLength={20} />
                </Field>
              </div>
              <div className="grid-2">
                <Field label="City">
                  <input value={parent.city} onChange={(e) => setParent({ ...parent, city: e.target.value })} />
                </Field>
                <Field label="Phone language">
                  <select value={parent.language} onChange={(e) => setParent({ ...parent, language: e.target.value })}>
                    <option value="hi">हिंदी</option>
                    <option value="en">English</option>
                  </select>
                </Field>
              </div>
              <div className="grid-2">
                <Field label="Window opens">
                  <input type="time" value={sched.windowStart} onChange={(e) => setSched({ ...sched, windowStart: e.target.value })} />
                </Field>
                <Field label="Window closes">
                  <input type="time" value={sched.windowEnd} onChange={(e) => setSched({ ...sched, windowEnd: e.target.value })} />
                </Field>
              </div>
              <div className="grid-2">
                <Field label="Alert number 1 after">
                  <select value={sched.primaryAfter} onChange={(e) => setSched({ ...sched, primaryAfter: e.target.value })}>
                    {[15, 30, 45, 60].map((m) => (
                      <option key={m} value={m}>
                        {m} min
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Alert everyone after">
                  <select value={sched.circleAfter} onChange={(e) => setSched({ ...sched, circleAfter: e.target.value })}>
                    {[30, 45, 60, 90, 120].map((m) => (
                      <option key={m} value={m}>
                        {m} min
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              {settingsErr && <div className="alert alert-error" style={{ marginBottom: 12 }}>{settingsErr}</div>}
              {isOwner && (
                <button className="btn btn-sm btn-ink" disabled={saveSettings.isPending}>
                  {saveSettings.isPending ? 'Saving...' : 'Save changes'}
                </button>
              )}
            </fieldset>
          </form>
        </section>

        <section className="card">
          <div className="card-head">
            <h3>Holiday mode</h3>
          </div>
          {circle.pausedUntil ? (
            <div>
              <p>
                Paused until <strong>{fmtDay(circle.pausedUntil)}</strong>
                {circle.pauseReason ? ` - ${circle.pauseReason}` : ''}. No reminders or alerts till then.
              </p>
              <button className="btn btn-sm" onClick={() => endHoliday.mutate()} disabled={endHoliday.isPending}>
                Turn alerts back on
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setHoliday.mutate();
              }}
            >
              <p className="tiny muted">Travelling, staying with a sibling, in hospital with family around? Pause the alerts so nobody panics.</p>
              <div className="grid-2">
                <Field label="Pause until (including)">
                  <input type="date" value={pause.until} onChange={(e) => setPause({ ...pause, until: e.target.value })} required />
                </Field>
                <Field label="Reason (optional)">
                  <input value={pause.reason} onChange={(e) => setPause({ ...pause, reason: e.target.value })} maxLength={80} placeholder="At Priya's in Pune" />
                </Field>
              </div>
              <button className="btn btn-sm" disabled={!pause.until || setHoliday.isPending}>
                Pause alerts
              </button>
            </form>
          )}
        </section>

        {isOwner && !circle.isDemo && (
          <section className="card danger">
            <h3>Delete this circle</h3>
            <p className="tiny muted">Removes the circle, its history, medicines, tasks and paired phones for everyone. This cannot be undone.</p>
            <button
              className="btn btn-sm"
              onClick={() => {
                const typed = window.prompt(`Type ${circle.parent.callName} to confirm`);
                if (typed === circle.parent.callName) deleteCircle.mutate();
              }}
            >
              Delete circle
            </button>
          </section>
        )}
        {user?.isDemo && <p className="tiny muted">This is a demo circle. It deletes itself after 48 hours.</p>}
      </div>
      {pairing && <PairModal circle={circle} onClose={closePair} />}
      {inviting && <InviteModal circle={circle} onClose={() => setInviting(false)} />}
    </div>
  );
}
