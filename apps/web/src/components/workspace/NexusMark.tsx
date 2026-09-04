export function NexusMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="5" cy="12" r="2.6" fill="currentColor" />
      <circle cx="19" cy="5" r="2.6" fill="currentColor" />
      <circle cx="19" cy="19" r="2.6" fill="currentColor" />
      <path d="M7 11l10-5M7 13l10 5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}
