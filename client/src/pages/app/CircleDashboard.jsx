import { NavLink, Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { get } from '../../lib/api.js';
import TodayTab from './TodayTab.jsx';
import MedicinesTab from './MedicinesTab.jsx';
import TasksTab from './TasksTab.jsx';
import CircleTab from './CircleTab.jsx';

const TABS = [
  ['today', 'Today'],
  ['medicines', 'Medicines'],
  ['tasks', 'Tasks'],
  ['circle', 'Circle & phone'],
];

export function useOverview(circleId) {
  return useQuery({
    queryKey: ['overview', circleId],
    queryFn: () => get(`/circles/${circleId}/overview`),
    // The ladder moves on its own, so keep the dashboard fresh.
    refetchInterval: 30_000,
  });
}

export default function CircleDashboard() {
  const { circleId, tab } = useParams();
  const q = useOverview(circleId);

  if (!TABS.some(([k]) => k === tab)) return <Navigate to={`/app/c/${circleId}/today`} replace />;

  if (q.isLoading) {
    return (
      <div className="dash">
        <div className="skeleton" style={{ height: 44, width: 280, marginBottom: 18 }} />
        <div className="dash-grid">
          <div className="skeleton" style={{ height: 260 }} />
          <div className="skeleton" style={{ height: 260 }} />
        </div>
      </div>
    );
  }
  if (q.isError) {
    return (
      <div className="dash">
        <div className="alert alert-error" role="alert">
          {q.error.status === 404 ? "This circle doesn't exist or you are not part of it." : q.error.message}
        </div>
      </div>
    );
  }

  const data = q.data;
  const { parent } = data.circle;
  return (
    <div className="dash">
      <div className="dash-head">
        <div>
          <h1>
            {parent.callName}
            <span className="dash-sub">
              {parent.name}
              {parent.city ? `, ${parent.city}` : ''}
            </span>
          </h1>
        </div>
        <nav className="tabs" aria-label="Sections">
          {TABS.map(([k, label]) => (
            <NavLink key={k} to={`/app/c/${circleId}/${k}`} className={({ isActive }) => `tab ${isActive ? 'is-on' : ''}`}>
              {label}
              {k === 'tasks' && data.tasks.open > 0 && <span className="tab-count">{data.tasks.open}</span>}
            </NavLink>
          ))}
        </nav>
      </div>
      {tab === 'today' && <TodayTab data={data} />}
      {tab === 'medicines' && <MedicinesTab data={data} />}
      {tab === 'tasks' && <TasksTab data={data} />}
      {tab === 'circle' && <CircleTab data={data} />}
    </div>
  );
}
