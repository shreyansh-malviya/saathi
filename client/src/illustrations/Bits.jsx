// Small hand-drawn illustrations used around the landing page.
const INK = '#1d2747';

/** Marigold marker scribble under a word. */
export function Scribble() {
  return (
    <svg className="scribble" viewBox="0 0 300 24" preserveAspectRatio="none" aria-hidden="true">
      <path d="M4 15 C 60 6, 120 20, 180 11 S 270 8, 296 14" fill="none" stroke="#e8a23a" strokeWidth="7" strokeLinecap="round" />
      <path d="M20 20 C 90 13, 170 22, 286 16" fill="none" stroke="#e8a23a" strokeWidth="3.5" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

export function Squiggle() {
  return (
    <svg className="squiggle" viewBox="0 0 160 30" aria-hidden="true">
      <path d="M4 15 q 10 -14 20 0 t 20 0 t 20 0 t 20 0 t 20 0 t 20 0 t 20 0" fill="none" stroke="#c63f2b" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function Face({ x, y, skin, hair, r = 13, grey = false }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={skin} stroke={INK} strokeWidth="2" />
      <path d={`M${x - r} ${y - 1} q 0 ${-r - 2} ${r} ${-r - 2} q ${r} 0 ${r} ${r + 2} q ${-r * 0.6} ${-r * 0.6} ${-r} ${-r * 0.55} q ${-r * 0.5} 0 ${-r} ${r * 0.55}z`} fill={hair} />
      {grey && <circle cx={x + r * 0.8} cy={y - r * 0.7} r={r * 0.4} fill={hair} stroke={INK} strokeWidth="1.4" />}
      <circle cx={x - 4} cy={y + 1} r="1.3" fill={INK} />
      <circle cx={x + 4} cy={y + 1} r="1.3" fill={INK} />
      <path d={`M${x - 3.5} ${y + 6} q 3.5 3 7 0`} fill="none" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
    </g>
  );
}

/** Step 1: three family members around a little house, linked by a red thread. */
export function StepCircle() {
  return (
    <svg className="step-art" viewBox="0 0 200 130" aria-hidden="true">
      <circle cx="100" cy="66" r="50" fill="none" stroke="#c63f2b" strokeWidth="2.5" strokeDasharray="6 6" />
      <g transform="translate(84 50)">
        <path d="M0 16 L16 2 L32 16 V36 H0Z" fill="#e9b7a6" stroke={INK} strokeWidth="2" />
        <rect x="12" y="22" width="9" height="14" fill="#3d7853" stroke={INK} strokeWidth="1.6" />
      </g>
      <Face x={100} y={16} skin="#b9784f" hair={INK} />
      <Face x={44} y={92} skin="#c68a5e" hair="#2a2a2a" />
      <Face x={156} y={92} skin="#d39a72" hair="#a3a5b4" grey />
      <text x="100" y="128" textAnchor="middle" fontFamily="Kalam, cursive" fontSize="13" fill={INK}>
        you, didi, Anil uncle
      </text>
    </svg>
  );
}

/** Step 2: a phone showing a 6-digit code. */
export function StepPair() {
  return (
    <svg className="step-art" viewBox="0 0 200 130" aria-hidden="true">
      <rect x="66" y="6" width="68" height="118" rx="12" fill={INK} />
      <rect x="72" y="16" width="56" height="98" rx="6" fill="#fbf6ec" />
      <text x="100" y="40" textAnchor="middle" fontFamily="Atkinson Hyperlegible, sans-serif" fontSize="8" fontWeight="700" fill="#4b5576">
        CODE
      </text>
      {[0, 1, 2].map((i) => (
        <rect key={`a${i}`} x={76 + i * 16} y="48" width="13" height="18" rx="3" fill="#fff" stroke={INK} strokeWidth="1.4" />
      ))}
      {[0, 1, 2].map((i) => (
        <rect key={`b${i}`} x={76 + i * 16} y="70" width="13" height="18" rx="3" fill="#fff" stroke={INK} strokeWidth="1.4" />
      ))}
      <g fontFamily="Atkinson Hyperlegible, sans-serif" fontWeight="700" fontSize="12" textAnchor="middle" fill={INK}>
        {['4', '8', '2', '0', '7', '5'].map((d, i) => (
          <text key={i} x={82.5 + (i % 3) * 16} y={(i < 3 ? 62 : 84)}>
            {d}
          </text>
        ))}
      </g>
      <rect x="78" y="96" width="44" height="10" rx="5" fill="#c63f2b" />
      {/* QR hint */}
      <g transform="translate(150 30)" fill={INK}>
        <rect width="30" height="30" fill="#fbf6ec" stroke={INK} strokeWidth="2" />
        <rect x="4" y="4" width="8" height="8" />
        <rect x="18" y="4" width="8" height="8" />
        <rect x="4" y="18" width="8" height="8" />
        <rect x="16" y="16" width="4" height="4" />
        <rect x="22" y="22" width="4" height="4" />
      </g>
      <text x="165" y="76" textAnchor="middle" fontFamily="Kalam, cursive" fontSize="12" fill={INK}>
        or scan
      </text>
      <path d="M20 70 q 20 -20 44 -6" fill="none" stroke={INK} strokeWidth="1.8" strokeDasharray="3 4" />
      <text x="22" y="94" fontFamily="Kalam, cursive" fontSize="13" fill={INK}>
        once
      </text>
    </svg>
  );
}

/** Step 3: a finger tapping a big round button, with a cup of chai. */
export function StepTap() {
  return (
    <svg className="step-art" viewBox="0 0 200 130" aria-hidden="true">
      <circle cx="96" cy="66" r="44" fill="#3d7853" stroke={INK} strokeWidth="2.5" />
      <circle cx="96" cy="66" r="52" fill="none" stroke="#e8a23a" strokeWidth="3" className="pulse-ring" />
      <text x="96" y="64" textAnchor="middle" fontFamily="Mukta, sans-serif" fontWeight="800" fontSize="15" fill="#fbf6ec">
        मैं ठीक
      </text>
      <text x="96" y="82" textAnchor="middle" fontFamily="Mukta, sans-serif" fontWeight="800" fontSize="15" fill="#fbf6ec">
        हूँ
      </text>
      {/* finger */}
      <path d="M128 128 l-6 -30 q -2 -8 5 -9 q 6 -1 7 6 l3 14 l2 -2 q 6 -2 8 4 l2 4 q 6 -2 8 4 l4 13" fill="#c68a5e" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      {/* chai */}
      <path d="M22 96h22l-3 22h-16z" fill="#fbf6ec" stroke={INK} strokeWidth="2" />
      <path d="M44 100c7 0 7 9 0 9" fill="none" stroke={INK} strokeWidth="2" />
      <path d="M28 90c-3-4 3-6 0-11M36 90c-3-4 3-6 0-11" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}
