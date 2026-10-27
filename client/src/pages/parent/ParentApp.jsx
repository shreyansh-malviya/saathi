import { useEffect, useRef, useState } from 'react';
import { Route, Routes, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ParentScreen, { STRINGS } from '../../components/ParentScreen.jsx';
import { LogoMark } from '../../components/Logo.jsx';
import { get, post, patch } from '../../lib/api.js';
import { enablePush, pushSupported } from '../../lib/push.js';
import '../../styles/parent.css';

// The parent's side of Saathi. Lives at /p so it can be installed to the home
// screen on its own (manifest start_url is /p).

function readLang() {
  try {
    return localStorage.getItem('saathi.lang');
  } catch {
    return null;
  }
}

function saveLang(l) {
  try {
    localStorage.setItem('saathi.lang', l);
  } catch {
    /* private mode - fine */
  }
}

function useParentManifest() {
  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"]');
    const prev = link?.getAttribute('href');
    link?.setAttribute('href', '/manifest-parent.webmanifest');
    const theme = document.querySelector('meta[name="theme-color"]');
    document.title = 'Saathi - मैं ठीक हूँ';
    return () => {
      if (prev) link.setAttribute('href', prev);
      theme?.setAttribute('content', '#f4ead9');
    };
  }, []);
}

// ------------------------------------------------------------------ pairing

function PairForm({ initialCode = '', error: initialError = '' }) {
  const [digits, setDigits] = useState(() => (initialCode.replace(/\D/g, '') + '      ').slice(0, 6).split(''));
  const [error, setError] = useState(initialError);
  const [lang, setLang] = useState(readLang() || 'hi');
  const inputs = useRef([]);
  const qc = useQueryClient();
  const t =
    lang === 'hi'
      ? { title: 'फ़ोन जोड़िए', sub: 'बच्चों की स्क्रीन पर दिख रहा 6 अंकों का कोड डालिए।', go: 'जोड़ें', busy: 'जोड़ रहे हैं...' }
      : { title: 'Connect this phone', sub: "Type the 6-digit code shown on your family member's screen.", go: 'Connect', busy: 'Connecting...' };

  const pair = useMutation({
    mutationFn: (code) => post('/parent/pair', { code }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['parent-today'] }),
    onError: (e) => setError(e.message),
  });

  const code = digits.join('').replace(/\s/g, '');
  const setDigit = (i, v) => {
    const clean = v.replace(/\D/g, '');
    if (clean.length > 1) {
      // Pasted the whole code.
      const all = (clean + '      ').slice(0, 6).split('');
      setDigits(all);
      inputs.current[Math.min(clean.length, 5)]?.focus();
      return;
    }
    setDigits((d) => d.map((x, j) => (j === i ? clean || ' ' : x)));
    if (clean && i < 5) inputs.current[i + 1]?.focus();
  };

  return (
    <div className="pair-page">
      <div className="pair-top">
        <LogoMark size={48} />
        <button
          className="ps-lang"
          onClick={() => {
            const l = lang === 'hi' ? 'en' : 'hi';
            setLang(l);
            saveLang(l);
          }}
        >
          {lang === 'hi' ? 'English' : 'हिंदी'}
        </button>
      </div>
      <h1 className={lang === 'hi' ? 'hi' : ''}>{t.title}</h1>
      <p className={lang === 'hi' ? 'hi' : ''}>{t.sub}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError('');
          if (code.length === 6) pair.mutate(code);
        }}
      >
        <div className="code-boxes">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => (inputs.current[i] = el)}
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              maxLength={i === 0 ? 6 : 1}
              value={d.trim()}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => e.key === 'Backspace' && !d.trim() && i > 0 && inputs.current[i - 1]?.focus()}
              aria-label={`Digit ${i + 1}`}
            />
          ))}
        </div>
        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}
        <button className="btn btn-primary btn-block pair-go" disabled={code.length !== 6 || pair.isPending}>
          {pair.isPending ? t.busy : t.go}
        </button>
      </form>
    </div>
  );
}

/** /p/pair?code=123456 - opened from the QR code. Pairs automatically. */
function AutoPair() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const code = params.get('code') || '';
  const [error, setError] = useState('');
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !/^\d{6}$/.test(code)) return;
    started.current = true;
    post('/parent/pair', { code })
      .then(() => {
        qc.invalidateQueries({ queryKey: ['parent-today'] });
        navigate('/p', { replace: true });
      })
      .catch((e) => setError(e.message));
  }, [code, navigate, qc]);
  if (error || !/^\d{6}$/.test(code)) return <PairForm initialCode={code} error={error} />;
  return (
    <div className="pair-page" style={{ placeItems: 'center' }}>
      <div className="spinner" />
    </div>
  );
}

// ------------------------------------------------------------------ home

function ParentHome() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState({});
  const [helpSent, setHelpSent] = useState(false);
  const [err, setErr] = useState('');
  const [pushState, setPushState] = useState('idle');
  const q = useQuery({
    queryKey: ['parent-today'],
    queryFn: () => get('/parent/today'),
    refetchInterval: 60_000,
    retry: (n, e) => e.status !== 401 && n < 2,
  });
  const [lang, setLang] = useState(readLang());

  const run = async (key, fn) => {
    setBusy((b) => ({ ...b, [key]: true }));
    setErr('');
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ['parent-today'] });
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy((b) => ({ ...b, [key]: false }));
    }
  };

  if (q.isLoading) {
    return (
      <div className="pair-page" style={{ placeItems: 'center' }}>
        <div className="spinner" />
      </div>
    );
  }
  if (q.isError && q.error.status === 401) return <PairForm error={q.error.message === 'This phone is not paired yet.' ? '' : q.error.message} />;
  if (q.isError) {
    return (
      <div className="pair-page">
        <div className="alert alert-error">{q.error.message}</div>
        <button className="btn" onClick={() => q.refetch()}>
          Try again / फिर से कोशिश करें
        </button>
      </div>
    );
  }

  const d = q.data;
  const l = lang || d.parent.language;
  const t = STRINGS[l];
  const canPush = pushSupported() && d.push.publicKey && !d.push.enabled && pushState !== 'done';

  return (
    <div className="parent-app">
      {err && (
        <div className="alert alert-error" role="alert" style={{ margin: '12px 16px 0' }}>
          {err}
        </div>
      )}
      <ParentScreen
        lang={l}
        onLang={(x) => {
          setLang(x);
          saveLang(x);
        }}
        callName={d.parent.callName}
        status={d.status}
        checkedInAt={d.checkedInAt}
        mood={d.mood}
        doses={d.doses}
        family={d.family}
        busy={busy}
        helpSent={helpSent}
        onCheckIn={() => run('checkin', () => post('/parent/checkin', { mood: 'good' }))}
        onMood={(m) => run('mood', () => patch('/parent/mood', { mood: m }))}
        onDose={(dose) => run(`dose-${dose.medicineId}-${dose.time}`, () => post('/parent/doses', { medicineId: dose.medicineId, time: dose.time }))}
        onHelp={() =>
          run('help', async () => {
            await post('/parent/help');
            setHelpSent(true);
          })
        }
      />
      {canPush && (
        <div className="push-ask">
          <p>{l === 'hi' ? 'अगर भूल जाएँ तो फ़ोन याद दिला दे?' : 'Want a reminder if you forget?'}</p>
          <button
            className="btn btn-sm btn-ink"
            disabled={pushState === 'busy'}
            onClick={async () => {
              setPushState('busy');
              try {
                await enablePush('parent', d.push.publicKey);
                setPushState('done');
              } catch (e) {
                setErr(e.message);
                setPushState('idle');
              }
            }}
          >
            {l === 'hi' ? 'हाँ, याद दिलाएँ' : 'Yes, remind me'}
          </button>
        </div>
      )}
      <p className="parent-foot">{t === STRINGS.hi ? 'साथी' : 'Saathi'}</p>
    </div>
  );
}

export default function ParentApp() {
  useParentManifest();
  return (
    <Routes>
      <Route path="pair" element={<AutoPair />} />
      <Route path="*" element={<ParentHome />} />
    </Routes>
  );
}
