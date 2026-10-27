import { Link } from 'react-router-dom';
import Logo from '../components/Logo.jsx';

export default function NotFound() {
  return (
    <div className="center-page">
      <Logo />
      <div className="card" style={{ maxWidth: 460, textAlign: 'center' }}>
        <p className="kicker">Return to sender</p>
        <h1 style={{ fontSize: '2.2rem' }}>This address doesn't exist.</h1>
        <p className="muted">The page may have moved, or the link was typed slightly wrong.</p>
        <Link to="/" className="btn btn-ink">
          Back to the home page
        </Link>
      </div>
    </div>
  );
}
