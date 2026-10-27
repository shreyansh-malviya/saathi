// Hero illustration: two postcards, one from Indore (Maa on her verandah with
// chai) and one from Bengaluru (her son at his desk). A red thread connects the
// two phones and a little envelope travels along it every few seconds.
// Hand-built SVG so it stays crisp, tiny and animatable.

const INK = '#1d2747';

function Postmark({ x, y, r = 34, label = 'SAATHI * DAILY HELLO *', center = '8:12', rotate = -12 }) {
  const id = `pm-${x}-${y}`;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`} opacity="0.85">
      <defs>
        <path id={id} d={`M ${-r + 7} 0 a ${r - 7} ${r - 7} 0 1 1 ${2 * (r - 7)} 0 a ${r - 7} ${r - 7} 0 1 1 ${-2 * (r - 7)} 0`} />
      </defs>
      <circle r={r} fill="none" stroke="#2f4f93" strokeWidth="2" />
      <circle r={r - 14} fill="none" stroke="#2f4f93" strokeWidth="1.5" />
      <text fill="#2f4f93" fontSize="8.5" fontFamily="Atkinson Hyperlegible, sans-serif" fontWeight="700" letterSpacing="1.6">
        <textPath href={`#${id}`}>{label}</textPath>
      </text>
      <text textAnchor="middle" y="4" fill="#2f4f93" fontSize="12" fontWeight="700" fontFamily="Atkinson Hyperlegible, sans-serif">
        {center}
      </text>
      {/* wavy cancellation lines */}
      <path d={`M ${r + 4} -10 q 10 -6 20 0 t 20 0 t 20 0 M ${r + 4} 0 q 10 -6 20 0 t 20 0 t 20 0 M ${r + 4} 10 q 10 -6 20 0 t 20 0 t 20 0`} fill="none" stroke="#2f4f93" strokeWidth="1.6" />
    </g>
  );
}

function IndoreCard() {
  return (
    <g>
      {/* card */}
      <rect x="0" y="0" width="300" height="262" rx="6" fill="#fbf6ec" stroke={INK} strokeWidth="2.5" />
      <clipPath id="clip-indore">
        <rect x="14" y="14" width="272" height="192" rx="3" />
      </clipPath>
      <g clipPath="url(#clip-indore)">
        <rect x="14" y="14" width="272" height="192" fill="#f8e2b8" />
        <circle cx="236" cy="50" r="22" fill="#f2c14e" />
        <g className="hero-sunrays" stroke="#e8a23a" strokeWidth="2.5" strokeLinecap="round">
          <path d="M236 18v-8M262 26l6-6M210 26l-6-6M268 50h8" />
        </g>
        {/* house wall */}
        <rect x="14" y="74" width="272" height="132" fill="#e9b7a6" />
        <path d="M14 74 H286" stroke={INK} strokeWidth="2.5" />
        <rect x="14" y="66" width="272" height="10" fill="#c98f7c" />
        {/* window with grill */}
        <rect x="34" y="96" width="54" height="46" fill="#a8c6e6" stroke={INK} strokeWidth="2" />
        <path d="M47.5 96v46M61 96v46M74.5 96v46" stroke={INK} strokeWidth="1.5" />
        {/* door */}
        <rect x="178" y="100" width="58" height="106" fill="#3d7853" stroke={INK} strokeWidth="2.5" />
        <path d="M207 100v106" stroke={INK} strokeWidth="2" />
        <circle cx="201" cy="156" r="2.4" fill="#f2c14e" />
        <circle cx="213" cy="156" r="2.4" fill="#f2c14e" />
        {/* toran garland */}
        <path d="M174 102 q 37 18 66 0" fill="none" stroke="#3d7853" strokeWidth="1.5" />
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <circle key={i} cx={180 + i * 9} cy={104 + Math.sin((i / 6) * Math.PI) * 8} r="3.6" fill={i % 2 ? '#3d7853' : '#e8a23a'} stroke={INK} strokeWidth="0.8" />
        ))}
        {/* verandah floor */}
        <rect x="14" y="190" width="272" height="16" fill="#d9c2a0" />
        <path d="M14 190H286" stroke={INK} strokeWidth="2" />
        {/* tulsi pot */}
        <path d="M250 190 l-6 -26 h34 l-6 26z" fill="#c63f2b" stroke={INK} strokeWidth="2" />
        <rect x="241" y="158" width="40" height="8" rx="2" fill="#c63f2b" stroke={INK} strokeWidth="2" />
        <g fill="#3d7853" stroke={INK} strokeWidth="1.2">
          <ellipse cx="261" cy="146" rx="5" ry="10" />
          <ellipse cx="252" cy="150" rx="4" ry="8" transform="rotate(-30 252 150)" />
          <ellipse cx="270" cy="150" rx="4" ry="8" transform="rotate(30 270 150)" />
          <ellipse cx="261" cy="134" rx="3.5" ry="7" />
        </g>
        {/* chai on a little stool, with steam */}
        <rect x="116" y="170" width="30" height="5" rx="2" fill="#8a5a2b" stroke={INK} strokeWidth="1.5" />
        <path d="M120 175v15M142 175v15" stroke={INK} strokeWidth="2" />
        <path d="M124 158h14l-2 12h-10z" fill="#fbf6ec" stroke={INK} strokeWidth="1.8" />
        <path d="M138 161c5 0 5 6 0 6" fill="none" stroke={INK} strokeWidth="1.6" />
        <g className="hero-steam" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" opacity="0.55">
          <path d="M128 152c-3-4 3-6 0-11" />
          <path d="M134 152c-3-4 3-6 0-11" />
        </g>
        {/* cane chair back */}
        <path d="M58 188 V128 q 30 -22 60 0 V188" fill="#d8a45f" stroke={INK} strokeWidth="2.2" />
        <path d="M66 134v50M76 128v56M88 124v60M100 128v56M110 134v50" stroke="#8a5a2b" strokeWidth="1.2" />
        {/* Maa */}
        <g className="hero-maa">
          {/* saree body */}
          <path d="M66 190 q -4 -40 12 -54 q 10 -8 22 -8 q 12 0 22 8 q 14 14 8 54z" fill="#e8a23a" stroke={INK} strokeWidth="2.2" />
          <path d="M80 136 q 22 18 46 54" fill="none" stroke="#c63f2b" strokeWidth="7" strokeLinecap="round" />
          <path d="M80 136 q 22 18 46 54" fill="none" stroke={INK} strokeWidth="1" strokeDasharray="2 4" />
          {/* neck + head */}
          <rect x="94" y="116" width="12" height="14" fill="#c68a5e" />
          <circle cx="100" cy="104" r="17" fill="#c68a5e" stroke={INK} strokeWidth="2.2" />
          {/* grey hair with bun */}
          <path d="M83 102 q 2 -20 17 -20 q 15 0 17 20 q -6 -9 -17 -10 q -11 1 -17 10z" fill="#a3a5b4" stroke={INK} strokeWidth="1.8" />
          <circle cx="118" cy="92" r="7" fill="#a3a5b4" stroke={INK} strokeWidth="1.8" />
          {/* specs, bindi, smile */}
          <circle cx="94" cy="105" r="4.5" fill="#fff8ef" fillOpacity="0.5" stroke={INK} strokeWidth="1.4" />
          <circle cx="106" cy="105" r="4.5" fill="#fff8ef" fillOpacity="0.5" stroke={INK} strokeWidth="1.4" />
          <path d="M98.5 105h3" stroke={INK} strokeWidth="1.4" />
          <circle cx="100" cy="96" r="1.8" fill="#c63f2b" />
          <path d="M95 113 q 5 4 10 0" fill="none" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />
          {/* arm and phone */}
          <path d="M116 142 q 14 6 16 18" fill="none" stroke="#c68a5e" strokeWidth="7" strokeLinecap="round" />
          <rect x="126" y="148" width="13" height="21" rx="2.5" fill={INK} transform="rotate(-12 132 158)" />
          <rect className="hero-phone-glow" x="128" y="151" width="9" height="13" rx="1.5" fill="#f2c14e" transform="rotate(-12 132 158)" />
        </g>
      </g>
      <rect x="14" y="14" width="272" height="192" rx="3" fill="none" stroke={INK} strokeWidth="2" />
      <text x="22" y="238" fontFamily="Kalam, cursive" fontSize="20" fill={INK}>
        Indore, 8:12 am
      </text>
      <text x="278" y="238" textAnchor="end" fontFamily="Mukta, sans-serif" fontSize="17" fontWeight="600" fill="#c63f2b">
        मैं ठीक हूँ
      </text>
    </g>
  );
}

function BengaluruCard() {
  return (
    <g>
      <rect x="0" y="0" width="300" height="236" rx="6" fill="#fbf6ec" stroke={INK} strokeWidth="2.5" />
      <clipPath id="clip-blr">
        <rect x="14" y="14" width="272" height="168" rx="3" />
      </clipPath>
      <g clipPath="url(#clip-blr)">
        <rect x="14" y="14" width="272" height="168" fill="#e6eef6" />
        {/* big window with the city */}
        <rect x="26" y="24" width="150" height="104" fill="#cfe0f1" stroke={INK} strokeWidth="2" />
        <g fill="#8fa9cb" stroke={INK} strokeWidth="1.2">
          <rect x="34" y="62" width="22" height="66" />
          <rect x="60" y="44" width="28" height="84" />
          <rect x="92" y="70" width="20" height="58" />
          <rect x="116" y="52" width="26" height="76" />
          <rect x="146" y="80" width="24" height="48" />
        </g>
        <g fill="#f2c14e">
          {[[40, 70], [40, 86], [66, 52], [76, 64], [66, 88], [122, 60], [132, 76], [122, 96], [98, 80], [152, 90]].map(([x, y]) => (
            <rect key={`${x}-${y}`} x={x} y={y} width="5" height="6" />
          ))}
        </g>
        <path d="M101 24v104M26 76h150" stroke={INK} strokeWidth="2" />
        {/* plant */}
        <path d="M250 128 l-4 -18 h22 l-4 18z" fill="#3d7853" stroke={INK} strokeWidth="1.8" />
        <g fill="#5d9a6f" stroke={INK} strokeWidth="1.1">
          <ellipse cx="257" cy="96" rx="4" ry="12" transform="rotate(-20 257 96)" />
          <ellipse cx="248" cy="100" rx="4" ry="10" transform="rotate(-50 248 100)" />
          <ellipse cx="266" cy="100" rx="4" ry="10" transform="rotate(40 266 100)" />
        </g>
        {/* desk */}
        <rect x="14" y="128" width="272" height="10" fill="#8a5a2b" stroke={INK} strokeWidth="2" />
        <rect x="14" y="138" width="272" height="44" fill="#d9c2a0" />
        {/* laptop */}
        <path d="M118 128 l14 -44 h56 l-14 44z" fill="#b8c2d6" stroke={INK} strokeWidth="2" />
        <rect x="108" y="124" width="70" height="5" rx="2" fill="#9aa5bd" stroke={INK} strokeWidth="1.5" />
        <circle cx="154" cy="106" r="4" fill="#fbf6ec" />
        {/* son */}
        <g className="hero-son">
          <path d="M186 128 q -4 -38 26 -44 q 28 4 26 44z" fill="#2f4f93" stroke={INK} strokeWidth="2.2" />
          <path d="M200 92 q 12 10 24 0" fill="none" stroke="#a8c6e6" strokeWidth="3" />
          <rect x="206" y="72" width="12" height="12" fill="#b9784f" />
          <circle cx="212" cy="60" r="16" fill="#b9784f" stroke={INK} strokeWidth="2.2" />
          <path d="M196 58 q 0 -18 16 -18 q 16 0 16 16 q -8 -8 -18 -6 q -8 2 -14 8z" fill={INK} />
          <circle cx="206" cy="61" r="1.6" fill={INK} />
          <path d="M207 69 q 4 3 8 0" fill="none" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
          {/* arm reaching for the phone */}
          <path d="M228 100 q 14 10 12 26" fill="none" stroke="#2f4f93" strokeWidth="9" strokeLinecap="round" />
        </g>
        {/* phone on desk + notification bubble */}
        <rect x="232" y="122" width="22" height="8" rx="2" fill={INK} />
        <g className="hero-bubble">
          <rect x="196" y="20" width="84" height="40" rx="8" fill="#fbf6ec" stroke={INK} strokeWidth="2" />
          <path d="M238 60 l6 8 l3 -8" fill="#fbf6ec" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <circle cx="208" cy="34" r="5" fill="#3d7853" />
          <path d="M205.5 34l2 2 3.5 -4" stroke="#fff" strokeWidth="1.6" fill="none" />
          <text x="218" y="38" fontFamily="Atkinson Hyperlegible, sans-serif" fontWeight="700" fontSize="10.5" fill={INK}>
            Maa: I'm OK
          </text>
          <text x="207" y="52" fontFamily="Atkinson Hyperlegible, sans-serif" fontSize="9" fill="#4b5576">
            8:12 am * feeling good
          </text>
        </g>
      </g>
      <rect x="14" y="14" width="272" height="168" rx="3" fill="none" stroke={INK} strokeWidth="2" />
      <text x="22" y="214" fontFamily="Kalam, cursive" fontSize="20" fill={INK}>
        Bengaluru, 8:12 am
      </text>
    </g>
  );
}

export default function HeroIllustration() {
  const thread = 'M 462 184 C 488 300, 330 300, 270 400';
  return (
    <svg className="hero-art" viewBox="0 0 680 560" role="img" aria-label="Maa on her verandah in Indore taps I'm OK on her phone. Her son in Bengaluru sees it on his.">
      <g transform="translate(330 22) rotate(4 150 130)">
        <IndoreCard />
      </g>
      <g transform="translate(26 290) rotate(-5 150 118)">
        <BengaluruCard />
      </g>

      {/* the red thread between the two phones */}
      <path d={thread} fill="none" stroke="#c63f2b" strokeWidth="3" strokeDasharray="7 7" strokeLinecap="round" className="hero-thread" />
      <EnvelopeOnThread path={thread} />

      <Postmark x={598} y={300} center="8:12" />
      {/* hand-written note with an arrow */}
      <g fontFamily="Kalam, cursive" fill={INK}>
        <text x="40" y="250" fontSize="22" transform="rotate(-4 40 250)">
          one tap from Maa...
        </text>
        <path d="M150 262 q 30 30 70 20" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
        <path d="M212 274 l10 7 l-11 4" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <text x="420" y="545" fontSize="22" transform="rotate(-3 420 545)">
          ...and you can breathe.
        </text>
      </g>
    </svg>
  );
}

// animateMotion needs the moving element as its parent, so the envelope gets its own group.
function EnvelopeOnThread({ path }) {
  return (
    <g>
      <g>
        <rect x="-13" y="-9" width="26" height="18" rx="2" fill="#fbf6ec" stroke={INK} strokeWidth="2" />
        <path d="M-13 -9 L0 2 L13 -9" fill="none" stroke={INK} strokeWidth="2" />
        <circle cx="8" cy="5" r="3" fill="#c63f2b" />
      </g>
      <animateMotion dur="4.5s" repeatCount="indefinite" path={path} keyPoints="0;1;1" keyTimes="0;0.6;1" calcMode="linear" />
      <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;0.08;0.55;0.62;1" dur="4.5s" repeatCount="indefinite" />
    </g>
  );
}
