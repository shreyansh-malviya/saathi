import { Navigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth.jsx';

// /app -> your first circle, or the set-up wizard if you have none yet.
export default function AppHome() {
  const { circles } = useAuth();
  if (circles.length) return <Navigate to={`/app/c/${circles[0].id}/today`} replace />;
  return <Navigate to="/app/new" replace />;
}
