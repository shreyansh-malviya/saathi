import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import HeroIllustration from '../illustrations/Hero.jsx';
import { StepCircle, StepPair, StepTap, Scribble, Squiggle } from '../illustrations/Bits.jsx';
import Ladder, { ladderSteps } from '../components/Ladder.jsx';
import ParentScreen from '../components/ParentScreen.jsx';
import { StampStrip, StampLegend } from '../components/Stamps.jsx';
import { useAuth } from '../lib/auth.jsx';
import { useStartDemo } from '../lib/demo.js';
import { fmtHhmm } from '../lib/format.js';

// Reveal-on-scroll: adds .is-in when an element enters the viewport.
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add('is-in'), io.unobserve(e.target))),
      { threshold: 0.15 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function Nav() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <header className="lnav">
      <Logo />
      <nav className={`lnav-links ${open ? 'is-open' : ''}`} onClick={() => setOpen(false)}>
        <a href="#how">How it works</a>
        <a href="#morning">A morning</a>
        <a href="#parents">For parents</a>
        <a href="#faq">Questions</a>
        {user ? (
          <Link className="btn btn-ink btn-sm" to="/app">
            Open dashboard
          </Link>
        ) : (
          <>
            <Link to="/login">Sign in</Link>
            <Link className="btn btn-ink btn-sm" to="/signup">
              Start a circle
            </Link>
          </>
        )}
      </nav>
      <button className="lnav-burger" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span />
        <span />
        <span />
      </button>
    </header>
  );
}

function DemoButton({ className = 'btn btn-primary', children = 'See the live demo' }) {
  const { start, starting } = useStartDemo();
  return (
    <button className={className} onClick={start} disabled={starting} aria-busy={starting || undefined}>
      {starting ? 'Setting up Maa’s circle...' : children}
    </button>
  );
}

// ------------------------------------------------------------------ morning simulator

const SIM_CHECKIN = { windowStartHhmm: '07:00', windowEndHhmm: '10:00', primaryAtHhmm: '10:30', circleAtHhmm: '11:00' };
const toMin = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const minToHhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

function MorningSimulator() {
  const [minute, setMinute] = useState(toMin('09:20'));
  const [checkedAt, setCheckedAt] = useState(null);
  const [playing, setPlaying] = useState(false);
  const ref = useRef(null);
  const steps = useMemo(() => ladderSteps(SIM_CHECKIN, { callName: 'Maa', primary: 'Rohan', everyone: 'Everyone' }), []);

  // Autoplay once when the section scrolls into view.
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setPlaying(true);
        io.disconnect();
      }
    }, { threshold: 0.5 });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!playing) return undefined;
    const id = setInterval(() => {
      setMinute((m) => {
        if (m >= toMin('11:10')) {
          setPlaying(false);
          return m;
        }
        return m + 2;
      });
    }, 70);
    return () => clearInterval(id);
  }, [playing]);

  const level = checkedAt !== null ? levelAt(checkedAt) : levelAt(minute);
  const state = checkedAt !== null ? 'stopped' : minute >= toMin('10:00') ? 'active' : 'calm';
  const cards = [];
  if (level >= 1) cards.push({ who: "Maa's phone", tone: 'marigold', title: 'नमस्ते! आज का हाल बताइए', body: '"मैं ठीक हूँ" दबाइए, ताकि बच्चों को चिंता न हो।', at: '10:00' });
  if (level >= 2) cards.push({ who: "Rohan's phone", tone: 'postbox', title: "Maa hasn't checked in yet", body: 'The window closed at 10:00 AM. Could you give a call?', at: '10:30' });
  if (level >= 3) cards.push({ who: 'Priya, Anil uncle', tone: 'postbox', title: "Maa still hasn't checked in", body: 'Please call Maa or someone nearby.', at: '11:00' });
  if (checkedAt !== null) cards.push({ who: 'Everyone alerted so far', tone: 'leaf', title: `Maa checked in at ${fmtHhmm(minToHhmm(checkedAt))}`, body: 'All clear. No need to call any more.', at: minToHhmm(checkedAt) });

  return (
    <div className="sim" ref={ref}>
      <div className="sim-controls card">
        <div className="sim-clock">
          <span className="sim-clock-label">Time in Indore</span>
          <span className="sim-clock-time">{fmtHhmm(minToHhmm(minute))}</span>
        </div>
        <input
          type="range"
          min={toMin('06:30')}
          max={toMin('11:30')}
          step={5}
          value={minute}
          onChange={(e) => {
            setPlaying(false);
            setMinute(Number(e.target.value));
            if (checkedAt !== null && Number(e.target.value) < checkedAt) setCheckedAt(null);
          }}
          aria-label="Scrub through the morning"
          className="sim-range"
        />
        <div className="sim-range-ticks" aria-hidden="true">
          <span>6:30</span>
          <span>8:00</span>
          <span>9:30</span>
          <span>11:00</span>
        </div>
        <div className="row sim-buttons">
          {checkedAt === null ? (
            <button className="btn btn-leaf btn-sm" onClick={() => { setPlaying(false); setCheckedAt(minute); }}>
              Maa taps "I'm OK" now
            </button>
          ) : (
            <button className="btn btn-sm" onClick={() => setCheckedAt(null)}>
              Undo the tap
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => { setCheckedAt(null); setMinute(toMin('09:20')); setPlaying(true); }}>
            Replay
          </button>
        </div>
        <Ladder steps={steps} level={level} state={state} compact />
      </div>
      <div className="sim-phones" aria-live="polite">
        {cards.length === 0 && (
          <div className="sim-quiet">
            <p className="hand">Quiet morning. Nobody gets pinged while Maa still has time.</p>
          </div>
        )}
        {cards.map((c) => (
          <div key={c.title} className={`sim-notif tone-${c.tone}`}>
            <div className="sim-notif-head">
              <span>{c.who}</span>
              <span>{fmtHhmm(c.at)}</span>
            </div>
            <strong className={c.title.match(/[ऀ-ॿ]/) ? 'hi' : ''}>{c.title}</strong>
            <p className={c.body.match(/[ऀ-ॿ]/) ? 'hi' : ''}>{c.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function levelAt(m) {
  if (m >= toMin('11:00')) return 3;
  if (m >= toMin('10:30')) return 2;
  if (m >= toMin('10:00')) return 1;
  return 0;
}

// ------------------------------------------------------------------ phone mock

function PhoneMock() {
  const [lang, setLang] = useState('hi');
  const [checked, setChecked] = useState(null);
  const [mood, setMood] = useState(null);
  const [doses, setDoses] = useState([
    { medicineId: 'a', name: 'Telma 40', dose: '1 tablet', instructions: 'after_food', time: '08:00', status: 'taken' },
    { medicineId: 'b', name: 'Glycomet 500', dose: '1 tablet', instructions: 'after_food', time: '08:00', status: 'due' },
    { medicineId: 'c', name: 'Shelcal 500', dose: '1 tablet', instructions: 'after_food', time: '14:00', status: 'upcoming' },
  ]);
  const [help, setHelp] = useState(false);
  return (
    <div className="phone">
      <div className="phone-notch" aria-hidden="true" />
      <div className="phone-screen">
        <ParentScreen
          preview
          lang={lang}
          onLang={setLang}
          callName="Maa"
          status={checked ? 'checked_in' : 'waiting'}
          checkedInAt={checked}
          mood={mood}
          doses={doses}
          family={[
            { name: 'Rohan Sharma', relation: 'Son', phone: '1' },
            { name: 'Priya Sharma', relation: 'Daughter', phone: '1' },
          ]}
          helpSent={help}
          onCheckIn={() => {
            setChecked(new Date());
            setMood('good');
          }}
          onMood={setMood}
          onDose={(d) => setDoses((all) => all.map((x) => (x === d ? { ...x, status: 'taken' } : x)))}
          onHelp={() => setHelp(true)}
        />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ sample stamps

function sampleMonth() {
  const out = [];
  const base = new Date();
  for (let i = 27; i >= 0; i--) {
    const d = new Date(base.getTime() - i * 86400000);
    const iso = d.toISOString().slice(0, 10);
    let day = { date: iso, status: 'checked_in', punctuality: 'on_time', mood: 'good' };
    if (i === 20) day = { date: iso, status: 'resolved' };
    if (i === 15 || i === 3) day = { ...day, punctuality: 'late' };
    if (i === 9 || i === 10 || i === 11) day = { date: iso, status: 'paused' };
    if (i === 6) day = { ...day, mood: 'unwell' };
    if (i === 24) day = { date: iso, status: 'missed' };
    out.push(day);
  }
  return out;
}

// ------------------------------------------------------------------ page

const FAQ = [
  ['Does my parent need to create an account?', 'No. You create the circle. On their phone they type a 6-digit code once (or scan a QR code you show them) and they stay signed in. No password, no OTP, no email.'],
  ['What if they forget to tap?', 'That is the whole point of the ladder. First their own phone reminds them. Then the first person in your circle is asked to call. Only if nobody marks it OK does everyone else get an alert. Each step happens once, so nobody gets spammed.'],
  ['We already have a family WhatsApp group. Why not that?', 'A WhatsApp "good morning" works until the morning it does not come. Then everyone sees the silence at a different time and nobody knows who is calling. Saathi notices the silence for you and gives one person the job first.'],
  ['What happens when Maa travels or visits my sister?', 'Turn on holiday mode until a date. No reminders, no alerts, and the calendar shows those days as a holiday, not as missed.'],
  ['Does it track location or listen in?', 'No. Saathi stores a tap, a mood, medicine ticks and the tasks your family writes. That is all.'],
  ['Does it work on iPhone and Android?', 'Yes. It runs in the browser and can be added to the home screen like an app. Notifications work on Android and on iPhones with iOS 16.4 or later once it is added to the home screen.'],
];

export default function Landing() {
  useReveal();
  const month = useMemo(sampleMonth, []);
  const navigate = useNavigate();

  return (
    <div className="landing">
      <Nav />

      {/* ---------------------------------------------------------------- hero */}
      <section className="hero">
        <div className="hero-copy">
          <p className="kicker">For everyone whose parents live in another city</p>
          <h1 className="hero-title">
            Know Maa is okay, <span className="scribbled">every morning<Scribble /></span>.
          </h1>
          <p className="hero-lede">
            Saathi gives your parent one big button: <strong className="hi-inline">मैं ठीक हूँ</strong>. One tap and the whole family knows. If the tap doesn't come,
            Saathi reminds them, then asks you to call, then your siblings and the neighbour. In that order, and only once.
          </p>
          <div className="hero-cta">
            <DemoButton />
            <button className="btn" onClick={() => navigate('/signup')}>
              Start your circle
            </button>
          </div>
          <p className="hero-note hand">The demo needs no sign-up. You'll be "Rohan", checking on his Maa in Indore.</p>
          <ul className="hero-facts">
            <li>Hindi and English</li>
            <li>No app store needed</li>
            <li>Free for families</li>
          </ul>
        </div>
        <div className="hero-visual">
          <HeroIllustration />
        </div>
      </section>

      {/* ---------------------------------------------------------------- the itch */}
      <section className="itch">
        <div className="clipping tape reveal">
          <p className="clipping-kicker">Problem #3 of the top 10 in Razorpay's Fix My Itch</p>
          <blockquote>"Why is caring for aging parents for sole earners across cities still fragmented and stressful?"</blockquote>
          <p className="clipping-foot">Picked from more than 50,000 problems Indians posted about, scored on how often it hurts and how badly.</p>
        </div>
        <div className="itch-story reveal">
          <h2>
            9:40 AM. Maa's phone <span className="underline-red">rings out</span>.
          </h2>
          <p>
            Maybe she's in the puja room. Maybe the phone is on silent again. Or maybe she slipped in the bathroom. You call Papa's old number, then the neighbour,
            then your sister, who is in a meeting and sees it at lunch.
          </p>
          <p>
            Every family in this situation has the same unspoken system: <em>someone</em> will notice. Saathi makes that someone a clock, and gives each person in the
            family a clear turn.
          </p>
        </div>
      </section>

      {/* ---------------------------------------------------------------- how */}
      <section className="how" id="how">
        <div className="section-head reveal">
          <p className="kicker">How it works</p>
          <h2>Set up in five minutes. Then forget about it.</h2>
        </div>
        <ol className="postcards">
          <li className="postcard reveal" style={{ '--tilt': '-2deg' }}>
            <span className="postcard-no">1</span>
            <StepCircle />
            <h3>Make a circle</h3>
            <p>Add Maa's name and her usual morning, say 7 to 10 AM. Invite your sister and the neighbour with a link. Put them in the order you want them called.</p>
          </li>
          <li className="postcard reveal" style={{ '--tilt': '1.5deg' }}>
            <span className="postcard-no">2</span>
            <StepPair />
            <h3>Pair her phone once</h3>
            <p>On her phone, open Saathi and type the 6-digit code from your screen, or scan the QR. Add it to the home screen. That's all the setup she ever does.</p>
          </li>
          <li className="postcard reveal" style={{ '--tilt': '-1deg' }}>
            <span className="postcard-no">3</span>
            <StepTap />
            <h3>One tap a day</h3>
            <p>She taps "मैं ठीक हूँ" with her morning chai and picks how she feels. You see it on your phone. If she doesn't, the ladder starts climbing.</p>
          </li>
        </ol>
      </section>

      {/* ---------------------------------------------------------------- simulator */}
      <section className="morning" id="morning">
        <div className="section-head reveal">
          <p className="kicker">Try it</p>
          <h2>Watch a morning go wrong (safely).</h2>
          <p className="muted">
            Drag the clock, or let it play. Then tap "I'm OK" at any point and see the ladder stop and an all-clear go out to everyone who was worried.
          </p>
        </div>
        <MorningSimulator />
      </section>

      {/* ---------------------------------------------------------------- parents */}
      <section className="parents" id="parents">
        <div className="parents-copy reveal">
          <p className="kicker">For Maa and Papa</p>
          <h2>Made for hands that shake and eyes that squint.</h2>
          <ul className="ticks">
            <li>
              <strong>One thing to do.</strong> A button the size of a chapati. Everything else is optional.
            </li>
            <li>
              <strong>Hindi first.</strong> Switch to English with one tap. No jargon like "sync" or "notifications".
            </li>
            <li>
              <strong>Never logs out.</strong> No password to forget. If the phone is lost, you unpair it from your dashboard.
            </li>
            <li>
              <strong>Medicines, ticked off.</strong> She sees today's doses in order and taps "ले ली". You see if the evening dose keeps getting skipped.
            </li>
            <li>
              <strong>A help button.</strong> "मदद चाहिए" alerts everyone at once, with a confirm step so it isn't pressed by accident.
            </li>
          </ul>
          <Squiggle />
        </div>
        <div className="parents-phone reveal">
          <PhoneMock />
          <p className="hand phone-caption">This phone works. Go on, tap it.</p>
        </div>
      </section>

      {/* ---------------------------------------------------------------- family */}
      <section className="family">
        <div className="section-head reveal">
          <p className="kicker">For you and your siblings</p>
          <h2>"Who's taking Papa to the cardiologist?"</h2>
          <p className="muted">The question that gets lost in the family group. On Saathi, someone taps "I'll do it" and the whole family can see it's handled.</p>
        </div>
        <div className="board-demo reveal">
          <div className="bd-col">
            <h4>Open</h4>
            <div className="bd-card">
              <span className="chip chip-inland">Doctor</span>
              <strong>Book eye check-up at Shankara Hospital</strong>
              <span className="muted tiny">Added by Priya, due Tue</span>
              <span className="bd-claim">I'll do it</span>
            </div>
            <div className="bd-card">
              <span className="chip chip-marigold">Repairs</span>
              <strong>Get the geyser fixed</strong>
              <span className="muted tiny">Added by Anil uncle</span>
            </div>
          </div>
          <div className="bd-col">
            <h4>Someone's on it</h4>
            <div className="bd-card bd-claimed">
              <span className="chip chip-ink">Bills</span>
              <strong>Pay MPEB electricity bill</strong>
              <span className="bd-who">Priya is on it</span>
            </div>
          </div>
          <div className="bd-col">
            <h4>Done</h4>
            <div className="bd-card bd-done">
              <span className="chip chip-leaf">Groceries</span>
              <strong>New batteries for the BP machine</strong>
              <span className="bd-who">Rohan, 2 days ago</span>
            </div>
          </div>
          <p className="board-note hand">Two people tap "I'll do it" at the same moment? Only one gets it. The other is told who did.</p>
        </div>
      </section>

      {/* ---------------------------------------------------------------- stamps */}
      <section className="stamps-sec">
        <div className="stamps-card card reveal">
          <div>
            <p className="kicker">The calendar</p>
            <h2>A month of mornings on one postcard.</h2>
            <p className="muted">
              Every day gets a stamp. Green for on time, marigold for late, blue when family called and confirmed, red when nobody did. Patterns show up on their own:
              late on Mondays, unwell after the weekend, the week she was at your sister's.
            </p>
            <StampLegend />
          </div>
          <StampStrip days={month} size="sm" />
        </div>
      </section>

      {/* ---------------------------------------------------------------- privacy */}
      <section className="privacy">
        <div className="privacy-inner reveal">
          <h2>What Saathi will never do.</h2>
          <ul className="nots">
            <li>Track where your parents are</li>
            <li>Use the camera or microphone</li>
            <li>Show ads or sell your family's data</li>
            <li>Alert anyone you didn't invite</li>
          </ul>
        </div>
      </section>

      {/* ---------------------------------------------------------------- faq */}
      <section className="faq" id="faq">
        <div className="section-head reveal">
          <p className="kicker">Questions families ask</p>
          <h2>Before you set it up</h2>
        </div>
        <div className="faq-list">
          {FAQ.map(([q, a]) => (
            <details key={q} className="faq-item reveal">
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- final cta */}
      <section className="final">
        <div className="final-card reveal">
          <div className="final-stamp" aria-hidden="true">
            <span>सा</span>
          </div>
          <h2>Write to Maa every morning, without writing a word.</h2>
          <p>Try the demo first. If it feels right, setting up your own circle takes five minutes.</p>
          <div className="hero-cta" style={{ justifyContent: 'center' }}>
            <DemoButton />
            <Link className="btn" to="/signup">
              Start your circle
            </Link>
          </div>
        </div>
      </section>

      <footer className="lfoot">
        <Logo small />
        <p className="muted tiny">
          Made in India for families spread across it. A student project built for the Scaler end-term, solving a real problem from{' '}
          <a href="https://razorpay.com/m/fix-my-itch/" target="_blank" rel="noreferrer">
            Razorpay's Fix My Itch
          </a>
          .
        </p>
        <nav className="lfoot-links">
          <Link to="/login">Sign in</Link>
          <Link to="/p">Parent's phone</Link>
          <a href="https://github.com/shreyansh-malviya/saathi" target="_blank" rel="noreferrer">
            Source code
          </a>
        </nav>
      </footer>
    </div>
  );
}
