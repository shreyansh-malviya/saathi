import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Modal from '../../components/Modal.jsx';
import Field from '../../components/Field.jsx';
import { get, post, patch, del } from '../../lib/api.js';
import { useToast } from '../../lib/toast.jsx';
import { fmtHhmm, fmtTime, fmtDay, INSTRUCTIONS } from '../../lib/format.js';

function MedicineForm({ circleId, initial, onClose }) {
  const [form, setForm] = useState(initial || { name: '', dose: '1 tablet', times: ['08:00'], instructions: 'after_food' });
  const [errors, setErrors] = useState({});
  const qc = useQueryClient();
  const toast = useToast();
  const save = useMutation({
    mutationFn: () => (initial ? patch(`/circles/${circleId}/medicines/${initial.id}`, form) : post(`/circles/${circleId}/medicines`, form)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['medicines', circleId] });
      qc.invalidateQueries({ queryKey: ['overview', circleId] });
      toast.ok(initial ? 'Medicine updated.' : `${form.name} added. It shows on the parent's phone from today.`);
      onClose();
    },
    onError: (e) => setErrors({ ...e.fields, _: Object.keys(e.fields || {}).length ? '' : e.message }),
  });
  const setTime = (i, v) => setForm((f) => ({ ...f, times: f.times.map((t, j) => (j === i ? v : t)) }));

  return (
    <Modal title={initial ? `Edit ${initial.name}` : 'Add a medicine'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        noValidate
      >
        {errors._ && <div className="alert alert-error">{errors._}</div>}
        <div className="grid-2">
          <Field label="Name" error={errors.name}>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Telma 40" />
          </Field>
          <Field label="Dose" error={errors.dose}>
            <input value={form.dose} onChange={(e) => setForm({ ...form, dose: e.target.value })} placeholder="1 tablet" />
          </Field>
        </div>
        <Field label="Times each day" error={errors.times || Object.entries(errors).find(([k]) => k.startsWith('times.'))?.[1]}>
          <div className="times">
            {form.times.map((t, i) => (
              <span key={i} className="time-pill">
                <input type="time" value={t} onChange={(e) => setTime(i, e.target.value)} aria-label={`Time ${i + 1}`} />
                {form.times.length > 1 && (
                  <button type="button" className="time-x" onClick={() => setForm((f) => ({ ...f, times: f.times.filter((_, j) => j !== i) }))} aria-label="Remove time">
                    x
                  </button>
                )}
              </span>
            ))}
            {form.times.length < 6 && (
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setForm((f) => ({ ...f, times: [...f.times, '20:00'] }))}>
                + Add a time
              </button>
            )}
          </div>
        </Field>
        <Field label="When">
          <div className="seg">
            {Object.entries(INSTRUCTIONS).map(([k, label]) => (
              <button type="button" key={k} className={form.instructions === k ? 'is-on' : ''} onClick={() => setForm({ ...form, instructions: k })}>
                {label}
              </button>
            ))}
          </div>
        </Field>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AdherenceChart({ adherence }) {
  if (!adherence.expected) return <p className="muted tiny">Adherence shows up once doses have been due.</p>;
  return (
    <div className="adh">
      {adherence.byDay.map((d) => {
        const pct = d.expected ? d.taken / d.expected : null;
        return (
          <div key={d.date} className="adh-col" title={`${fmtDay(d.date)}: ${d.taken} of ${d.expected} doses`}>
            <div className="adh-bar">
              {pct !== null && <span style={{ height: `${Math.max(pct * 100, 4)}%` }} className={pct >= 0.85 ? 'good' : pct >= 0.6 ? 'mid' : 'low'} />}
            </div>
            <span className="adh-label">{fmtDay(d.date, { weekday: 'short' })}</span>
            <span className="adh-num">{d.expected ? `${d.taken}/${d.expected}` : '-'}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function MedicinesTab({ data }) {
  const circleId = data.circle.id;
  const tz = data.circle.timezone;
  const [editing, setEditing] = useState(null);
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['medicines', circleId], queryFn: () => get(`/circles/${circleId}/medicines`) });

  const mark = useMutation({
    mutationFn: (d) => post(`/circles/${circleId}/medicines/${d.medicineId}/doses`, { time: d.time }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['medicines', circleId] });
      qc.invalidateQueries({ queryKey: ['overview', circleId] });
      toast.ok('Dose marked as taken.');
    },
    onError: (e) => toast.error(e),
  });
  const stop = useMutation({
    mutationFn: (m) => del(`/circles/${circleId}/medicines/${m.id}`),
    onSuccess: (_r, m) => {
      qc.invalidateQueries({ queryKey: ['medicines', circleId] });
      qc.invalidateQueries({ queryKey: ['overview', circleId] });
      toast.ok(`${m.name} removed.`);
    },
    onError: (e) => toast.error(e),
  });

  const today = q.data?.today || data.medicines.today;
  return (
    <div className="dash-grid">
      <div className="col">
        <section className="card">
          <div className="card-head">
            <h3>Today's doses</h3>
          </div>
          {today.length === 0 ? (
            <div className="empty">
              <span className="hand">Nothing scheduled today.</span>
            </div>
          ) : (
            <ul className="dose-list">
              {today.map((d) => (
                <li key={`${d.medicineId}-${d.time}`} className={`dose-row dose-${d.status}`}>
                  <span className="dose-time">{fmtHhmm(d.time)}</span>
                  <span className="dose-name">
                    {d.name}
                    <small className="muted"> {d.dose}, {INSTRUCTIONS[d.instructions].toLowerCase()}</small>
                  </span>
                  {d.status === 'taken' ? (
                    <span className="chip chip-leaf">
                      Taken {fmtTime(d.takenAt, tz)}
                      {d.source === 'family' ? ' (marked by family)' : ''}
                    </span>
                  ) : (
                    <button className="btn btn-sm" onClick={() => mark.mutate(d)} disabled={mark.isPending}>
                      Mark taken
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="tiny muted" style={{ marginTop: 10 }}>
            Usually {data.circle.parent.callName} ticks these on their phone. Mark one here only after you've confirmed on a call.
          </p>
        </section>
        <section className="card">
          <div className="card-head">
            <h3>Last 7 days</h3>
            {data.medicines.adherence.percent !== null && <span className="chip chip-inland">{data.medicines.adherence.percent}% taken</span>}
          </div>
          <AdherenceChart adherence={data.medicines.adherence} />
        </section>
      </div>
      <div className="col">
        <section className="card">
          <div className="card-head">
            <h3>Medicine list</h3>
            <button className="btn btn-sm btn-primary" onClick={() => setEditing('new')}>
              Add medicine
            </button>
          </div>
          {q.isLoading && <div className="skeleton" style={{ height: 120 }} />}
          {q.isError && <div className="alert alert-error">{q.error.message}</div>}
          {q.data?.medicines.length === 0 && (
            <div className="empty">
              <span className="hand">No medicines yet.</span>
              <span className="tiny">Add the daily ones first: BP, sugar, thyroid.</span>
            </div>
          )}
          <ul className="med-list">
            {q.data?.medicines.map((m) => (
              <li key={m.id} className="med-item">
                <div>
                  <strong>{m.name}</strong>
                  <span className="muted tiny">
                    {m.dose} - {m.times.map(fmtHhmm).join(', ')} - {INSTRUCTIONS[m.instructions].toLowerCase()}
                  </span>
                </div>
                <div className="row">
                  <button className="btn btn-sm btn-ghost" onClick={() => setEditing(m)}>
                    Edit
                  </button>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => window.confirm(`Stop ${m.name}? It will be removed from the parent's phone.`) && stop.mutate(m)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
      {editing && <MedicineForm circleId={circleId} initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
