import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import Logo from '../components/Logo.jsx';
import Field from '../components/Field.jsx';
import { post } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useStartDemo } from '../lib/demo.js';

// Only allow redirects inside the app (prevents open-redirects via ?next=).
function safeNext(next) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/app';
}

export default function Auth({ mode }) {
  const isSignup = mode === 'signup';
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const demo = useStartDemo();

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to={next} replace />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setErrors({});
    setMessage('');
    // Quick client-side checks; the server validates again.
    const local = {};
    if (isSignup && form.name.trim().length < 2) local.name = 'Tell us your name.';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) local.email = 'Enter a valid email address.';
    if (isSignup ? form.password.length < 8 : !form.password) local.password = isSignup ? 'Password must be at least 8 characters.' : 'Enter your password.';
    if (Object.keys(local).length) return setErrors(local);

    setBusy(true);
    try {
      const data = await post(isSignup ? '/auth/register' : '/auth/login', isSignup ? form : { email: form.email, password: form.password });
      qc.setQueryData(['me'], data);
      navigate(next, { replace: true });
    } catch (err) {
      setErrors(err.fields || {});
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <aside className="auth-letter" aria-hidden="true">
        <div className="letter">
          <p className="letter-to">Dear Maa,</p>
          <p>Please press the green button every morning after your chai. That's all. Then I won't call you ten times a day.</p>
          <p>Love,</p>
          <p className="letter-from">Rohan</p>
          <div className="letter-stamp">
            <span>सा</span>
          </div>
          <div className="letter-postmark">
            BENGALURU
            <br />
            27 OCT
          </div>
        </div>
      </aside>
      <main className="auth-main">
        <Logo />
        <div className="auth-box">
          <h1>{isSignup ? 'Start a care circle' : 'Welcome back'}</h1>
          <p className="muted">{isSignup ? 'For you, the one who checks on Maa or Papa. Your parent never needs an account.' : 'Sign in to see how everyone is doing today.'}</p>

          {message && (
            <div className="alert alert-error" role="alert">
              {message}
            </div>
          )}

          <form onSubmit={submit} noValidate>
            {isSignup && (
              <Field label="Your name" error={errors.name}>
                <input value={form.name} onChange={set('name')} autoComplete="name" placeholder="Rohan Sharma" />
              </Field>
            )}
            <Field label="Email" error={errors.email}>
              <input type="email" value={form.email} onChange={set('email')} autoComplete="email" placeholder="you@example.com" />
            </Field>
            <Field label="Password" error={errors.password} hint={isSignup ? 'At least 8 characters.' : undefined}>
              <input type="password" value={form.password} onChange={set('password')} autoComplete={isSignup ? 'new-password' : 'current-password'} />
            </Field>
            <button className="btn btn-primary btn-block" disabled={busy} aria-busy={busy || undefined}>
              {busy ? 'One moment...' : isSignup ? 'Create my account' : 'Sign in'}
            </button>
          </form>

          <p className="auth-switch">
            {isSignup ? (
              <>
                Already have an account? <Link to={`/login${params.toString() ? `?${params}` : ''}`}>Sign in</Link>
              </>
            ) : (
              <>
                New here? <Link to={`/signup${params.toString() ? `?${params}` : ''}`}>Start a circle</Link>
              </>
            )}
          </p>
          <div className="auth-demo">
            <span>Just looking?</span>
            <button className="link-btn" onClick={demo.start} disabled={demo.starting}>
              {demo.starting ? 'Setting up the demo...' : 'Open the live demo instead'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
