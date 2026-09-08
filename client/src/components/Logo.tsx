export function Mark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#00e5ff" />
          <stop offset="100%" stopColor="#7c5cff" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="16" fill="#0b1220" stroke="url(#cg)" strokeWidth="2" />
      <path
        d="M22 28c0-6 5-10 10-10s10 4 10 10v4h3v12H19V32h3v-4zm6 0c0-2.4 1.6-4 4-4s4 1.6 4 4v4h-8v-4z"
        fill="url(#cg)"
      />
      <circle cx="46" cy="18" r="3.2" fill="#2ee6a6" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <Mark size={compact ? 28 : 36} />
      <div className="leading-tight">
        <div className="font-semibold tracking-wide text-white">CipherRoom</div>
        {!compact && (
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-glow/70">
            ephemeral link
          </div>
        )}
      </div>
    </div>
  );
}
