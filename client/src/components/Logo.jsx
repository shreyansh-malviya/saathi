import { Link } from 'react-router-dom';

// The mark is a little postage stamp with "सा" (the first letter of Saathi) on it.
export function LogoMark({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <mask id="perf">
          <rect width="40" height="40" fill="#fff" />
          {Array.from({ length: 7 }).map((_, i) => (
            <g key={i} fill="#000">
              <circle cx={1 + i * 6.3} cy="0" r="2.1" />
              <circle cx={1 + i * 6.3} cy="40" r="2.1" />
              <circle cx="0" cy={1 + i * 6.3} r="2.1" />
              <circle cx="40" cy={1 + i * 6.3} r="2.1" />
            </g>
          ))}
        </mask>
      </defs>
      <rect width="40" height="40" fill="#c63f2b" mask="url(#perf)" />
      <rect x="5" y="5" width="30" height="30" fill="none" stroke="#fbf6ec" strokeWidth="1.4" />
      <text x="20" y="27.5" textAnchor="middle" fontFamily="Mukta, sans-serif" fontWeight="800" fontSize="19" fill="#fbf6ec">
        सा
      </text>
    </svg>
  );
}

export default function Logo({ to = '/', small = false }) {
  return (
    <Link to={to} className="logo" aria-label="Saathi home">
      <LogoMark size={small ? 28 : 34} />
      <span className="logo-word">Saathi</span>
    </Link>
  );
}
