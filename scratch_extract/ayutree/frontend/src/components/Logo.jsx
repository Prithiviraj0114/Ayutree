import { Link } from "react-router-dom";

export default function Logo({ className = "", to = "/" }) {
  return (
    <Link to={to} data-testid="brand-logo" className={`inline-flex items-center gap-2 ${className}`}>
      <svg width="36" height="36" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <g fill="#C2A878">
          <circle cx="30" cy="11" r="5" />
          <circle cx="17" cy="20" r="4" />
          <circle cx="43" cy="20" r="4" />
          <circle cx="10" cy="32" r="3.5" />
          <circle cx="50" cy="32" r="3.5" />
          <circle cx="22" cy="28" r="3" />
          <circle cx="38" cy="28" r="3" />
          <rect x="28" y="22" width="4" height="30" rx="1.5" />
          <path d="M30 50 C 24 46, 20 40, 22 34" stroke="#C2A878" strokeWidth="1.4" fill="none" />
          <path d="M30 50 C 36 46, 40 40, 38 34" stroke="#C2A878" strokeWidth="1.4" fill="none" />
        </g>
      </svg>
      <div className="leading-tight">
        <div className="font-serif-display text-2xl tracking-tight" style={{ color: "#1A3B32" }}>ayu<span className="italic font-light"> tree</span></div>
      </div>
    </Link>
  );
}
