export function Logo() {
  return (
    <div className="logo" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <path
          d="M6 15.5L11.8 8.5L18 14.2"
          stroke="#fff"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.4"
        />
        <circle cx="6" cy="15.5" r="3" fill="#34d399" />
        <circle cx="11.8" cy="8.5" r="3" fill="#fff" />
        <circle cx="18" cy="14.2" r="3" fill="#60a5fa" />
      </svg>
    </div>
  );
}
