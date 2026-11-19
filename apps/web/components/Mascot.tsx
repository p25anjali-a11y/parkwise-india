/** Parky, an original little car mascot. */
export function Mascot({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" role="img" aria-label="Parky the friendly car">
      <ellipse cx="48" cy="86" rx="30" ry="6" fill="rgba(0,0,0,.18)" />
      <rect x="10" y="38" width="76" height="40" rx="18" fill="#ffc83d" />
      <path d="M26 40 L34 18 H62 L70 40 Z" fill="#ffd96a" />
      <rect x="35" y="22" width="26" height="16" rx="5" fill="#cfe4ff" />
      <circle cx="34" cy="56" r="9" fill="#fff" />
      <circle cx="62" cy="56" r="9" fill="#fff" />
      <circle cx="36" cy="57" r="4.5" fill="#1d2340" />
      <circle cx="60" cy="57" r="4.5" fill="#1d2340" />
      <path d="M38 68 Q48 77 58 68" stroke="#1d2340" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="26" cy="78" r="8" fill="#1d2340" />
      <circle cx="70" cy="78" r="8" fill="#1d2340" />
      <circle cx="26" cy="78" r="3" fill="#cfd5f5" />
      <circle cx="70" cy="78" r="3" fill="#cfd5f5" />
    </svg>
  );
}
