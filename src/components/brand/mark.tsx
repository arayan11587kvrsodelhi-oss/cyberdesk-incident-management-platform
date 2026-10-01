export function Mark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      role="img"
      aria-label="CYBERDESK"
    >
      {/* Reticle brackets — the console framing device */}
      <path
        d="M4 10V5.5A1.5 1.5 0 0 1 5.5 4H10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="square"
        opacity="0.55"
      />
      <path
        d="M22 4h4.5A1.5 1.5 0 0 1 28 5.5V10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="square"
        opacity="0.55"
      />
      <path
        d="M28 22v4.5a1.5 1.5 0 0 1-1.5 1.5H22"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="square"
        opacity="0.55"
      />
      <path
        d="M10 28H5.5A1.5 1.5 0 0 1 4 26.5V22"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="square"
        opacity="0.55"
      />
      {/* Shield cut from a bracket */}
      <path
        d="M16 6.6l7.2 2.9v6.2c0 4.4-2.9 7.6-7.2 9.6-4.3-2-7.2-5.2-7.2-9.6V9.5L16 6.6Z"
        fill="var(--accent)"
        fillOpacity="0.16"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Terminal caret inside the shield */}
      <path
        d="M13.2 14.4l2.8 2.6-2.8 2.6M16.9 19.8h3.1"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      <span className="text-[15px] font-bold tracking-[0.16em]">CYBER</span>
      <span className="text-[15px] font-normal tracking-[0.16em] text-[var(--muted)]">DESK</span>
    </span>
  );
}
