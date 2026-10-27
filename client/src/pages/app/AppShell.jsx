import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Logo from '../../components/Logo.jsx';
import { useAuth } from '../../lib/auth.jsx';
import { get, post } from '../../lib/api.js';
import { timeAgo } from '../../lib/format.js';

function Bell() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const qc = useQueryClient();
  const navigate = useNavigate();
  // Poll every 30s so alerts show up even without push notifications.
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => get('/me/notifications'), refetchInterval: 30_000 });
  const readAll = useMutation({
    mutationFn: () => post('/me/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const unread = q.data?.unread || 0;
  return (
    <div className="bell" ref={ref}>
      <button className="bell-btn" onClick={() => setOpen((o) => !o)} aria-label={`Notifications, ${unread} unread`} aria-expanded={open}>
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
          <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z M10 20a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
        {unread > 0 && <span className="bell-count">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="bell-panel card">
          <div className="bell-head">
            <strong>Notifications</strong>
            {unread > 0 && (
              <button className="link-btn tiny" onClick={() => readAll.mutate()}>
                Mark all read
              </button>
            )}
          </div>
          {q.isLoading && <div className="skeleton" style={{ height: 60 }} />}
          {q.isError && <p className="muted tiny">Could not load notifications.</p>}
          {q.data?.items.length === 0 && (
            <div className="empty">
              <span className="hand">Nothing yet. That's a good thing.</span>
            </div>
          )}
          <ul className="bell-list">
            {q.data?.items.map((n) => (
              <li key={n.id} className={`bell-item sev-${n.severity} ${n.readAt ? '' : 'is-unread'}`}>
                <button
                  onClick={() => {
                    post(`/me/notifications/${n.id}/read`).then(() => qc.invalidateQueries({ queryKey: ['notifications'] }));
                    setOpen(false);
                    if (n.circle) navigate(`/app/c/${n.circle}/today`);
                  }}
                >
                  <strong>{n.title}</strong>
                  {n.body && <span>{n.body}</span>}
                  <small>{timeAgo(n.at)}</small>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function AppShell() {
  const { user, circles, loading, error, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { circleId } = useParams();
  const [menu, setMenu] = useState(false);

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '70vh' }}>
        <div className="spinner" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="center-page">
        <div className="alert alert-error">Could not reach Saathi. Check your connection and refresh.</div>
      </div>
    );
  }
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;

  // circleId isn't a param of this route; read it from the path for the switcher.
  const activeId = circleId || location.pathname.match(/\/app\/c\/([^/]+)/)?.[1];

  return (
    <div className="app">
      <header className="app-top">
        <Logo to="/app" small />
        {circles.length > 0 && (
          <label className="circle-switch">
            <span className="sr-only">Circle</span>
            <select
              value={activeId || ''}
              onChange={(e) => (e.target.value === '__new' ? navigate('/app/new') : navigate(`/app/c/${e.target.value}/today`))}
            >
              {!activeId && <option value="">Choose a circle</option>}
              {circles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.callName}'s circle{c.city ? ` - ${c.city}` : ''}
                </option>
              ))}
              <option value="__new">+ New circle</option>
            </select>
          </label>
        )}
        <div className="app-top-right">
          {user.isDemo && <span className="chip chip-marigold">Demo</span>}
          <Bell />
          <div className="usermenu">
            <button className="avatar" onClick={() => setMenu((m) => !m)} aria-label="Account menu" aria-expanded={menu}>
              {user.name.slice(0, 1).toUpperCase()}
            </button>
            {menu && (
              <div className="usermenu-panel card" onMouseLeave={() => setMenu(false)}>
                <strong>{user.name}</strong>
                <span className="muted tiny">{user.email}</span>
                <hr className="divider" />
                <Link to="/" onClick={() => setMenu(false)}>
                  Home page
                </Link>
                <Link to="/p" target="_blank" onClick={() => setMenu(false)}>
                  Open parent's phone view
                </Link>
                <button
                  className="link-btn"
                  onClick={async () => {
                    await logout();
                    navigate('/');
                  }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
