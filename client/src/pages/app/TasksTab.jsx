import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Modal from '../../components/Modal.jsx';
import Field from '../../components/Field.jsx';
import { get, post, del } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import { CATEGORY, fmtDay, timeAgo } from '../../lib/format.js';

const CAT_TONE = { doctor: 'inland', medicines: 'leaf', bills: 'ink', groceries: 'leaf', repairs: 'marigold', other: 'ink' };

function NewTask({ circleId, callName, onClose }) {
  const [form, setForm] = useState({ title: '', notes: '', category: 'doctor', dueDate: '' });
  const [errors, setErrors] = useState({});
  const qc = useQueryClient();
  const toast = useToast();
  const m = useMutation({
    mutationFn: () => post(`/circles/${circleId}/tasks`, { ...form, dueDate: form.dueDate || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', circleId] });
      qc.invalidateQueries({ queryKey: ['overview', circleId] });
      toast.ok('Task added. Everyone in the circle was notified.');
      onClose();
    },
    onError: (e) => setErrors({ ...e.fields, _: e.message }),
  });
  return (
    <Modal title={`Something ${callName} needs`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
        noValidate
      >
        {errors._ && !errors.title && <div className="alert alert-error">{errors._}</div>}
        <Field label="What needs doing?" error={errors.title}>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Take Papa to the cardiologist" maxLength={90} />
        </Field>
        <div className="grid-2">
          <Field label="Type">
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {Object.entries(CATEGORY).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="By when (optional)" error={errors.dueDate}>
            <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </Field>
        </div>
        <Field label="Notes (optional)">
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={400} placeholder="Dr. Jain sits on Tuesdays." />
        </Field>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={m.isPending}>
            {m.isPending ? 'Adding...' : 'Add task'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function TaskCard({ task, circleId, me, isOwner }) {
  const qc = useQueryClient();
  const toast = useToast();
  const act = useMutation({
    mutationFn: ({ action }) => (action === 'delete' ? del(`/circles/${circleId}/tasks/${task.id}`) : post(`/circles/${circleId}/tasks/${task.id}/${action}`)),
    onSuccess: (_r, { action }) => {
      qc.invalidateQueries({ queryKey: ['tasks', circleId] });
      qc.invalidateQueries({ queryKey: ['overview', circleId] });
      if (action === 'claim') toast.ok("It's yours. Everyone can see you're on it.");
      if (action === 'complete') toast.ok('Done. Nice one.');
    },
    onError: (e) => {
      toast.error(e);
      // Someone else got there first: refresh so the board shows who.
      qc.invalidateQueries({ queryKey: ['tasks', circleId] });
    },
  });
  const mine = task.claimedById === me;
  const overdue = task.status !== 'done' && task.dueDate && task.dueDate < new Date().toISOString().slice(0, 10);
  return (
    <article className={`task task-${task.status}`}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className={`chip chip-${CAT_TONE[task.category]}`}>{CATEGORY[task.category]}</span>
        {task.dueDate && <span className={`tiny ${overdue ? 'task-overdue' : 'muted'}`}>{overdue ? 'Overdue - ' : 'By '}{fmtDay(task.dueDate)}</span>}
      </div>
      <h4>{task.title}</h4>
      {task.notes && <p className="task-notes">{task.notes}</p>}
      <p className="tiny muted">
        Added by {task.createdBy} {timeAgo(task.createdAt)}
      </p>
      {task.status === 'claimed' && <p className="task-who">{mine ? "You're on it" : `${task.claimedBy} is on it`}</p>}
      {task.status === 'done' && (
        <p className="task-who">
          Done by {task.doneBy} {timeAgo(task.doneAt)}
        </p>
      )}
      <div className="task-actions">
        {task.status === 'open' && (
          <button className="btn btn-sm btn-primary" onClick={() => act.mutate({ action: 'claim' })} disabled={act.isPending}>
            I'll do it
          </button>
        )}
        {task.status === 'claimed' && mine && (
          <>
            <button className="btn btn-sm btn-leaf" onClick={() => act.mutate({ action: 'complete' })} disabled={act.isPending}>
              Mark done
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => act.mutate({ action: 'release' })} disabled={act.isPending}>
              Hand back
            </button>
          </>
        )}
        {task.status === 'claimed' && !mine && isOwner && (
          <button className="btn btn-sm btn-ghost" onClick={() => act.mutate({ action: 'complete' })} disabled={act.isPending}>
            Mark done
          </button>
        )}
        {task.canDelete && task.status !== 'claimed' && (
          <button className="btn btn-sm btn-ghost" onClick={() => window.confirm('Delete this task?') && act.mutate({ action: 'delete' })} disabled={act.isPending}>
            Delete
          </button>
        )}
      </div>
    </article>
  );
}

export default function TasksTab({ data }) {
  const circleId = data.circle.id;
  const { user } = useAuth();
  const [adding, setAdding] = useState(false);
  const q = useQuery({ queryKey: ['tasks', circleId], queryFn: () => get(`/circles/${circleId}/tasks`), refetchInterval: 30_000 });
  const isOwner = data.me.role === 'owner';
  const cols = [
    ['open', 'Needs someone'],
    ['claimed', "Someone's on it"],
    ['done', 'Done (last 2 weeks)'],
  ];

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap' }}>
        <p className="muted" style={{ margin: 0 }}>
          Things {data.circle.parent.callName} needs done. Tap "I'll do it" so nobody does it twice and nothing falls through.
        </p>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          Add a task
        </button>
      </div>
      {q.isLoading && <div className="skeleton" style={{ height: 240 }} />}
      {q.isError && <div className="alert alert-error">{q.error.message}</div>}
      {q.data && (
        <div className="board">
          {cols.map(([status, label]) => {
            const items = q.data.tasks.filter((t) => t.status === status);
            return (
              <section key={status} className={`board-col col-${status}`}>
                <h3>
                  {label} <span className="muted">({items.length})</span>
                </h3>
                {items.length === 0 && <div className="board-empty hand">{status === 'open' ? 'Nothing waiting. Lovely.' : status === 'claimed' ? 'Nobody has picked anything up.' : 'Nothing finished recently.'}</div>}
                {items.map((t) => (
                  <TaskCard key={t.id} task={t} circleId={circleId} me={user.id} isOwner={isOwner} />
                ))}
              </section>
            );
          })}
        </div>
      )}
      {adding && <NewTask circleId={circleId} callName={data.circle.parent.callName} onClose={() => setAdding(false)} />}
    </div>
  );
}
