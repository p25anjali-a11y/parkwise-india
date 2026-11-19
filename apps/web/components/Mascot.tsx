/** Parkwise logo mark: a monogram on a dark tile. */
export function Mascot({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Parkwise">
      <rect x="1" y="1" width="62" height="62" rx="18" fill="#12151c" stroke="#c9a96a" strokeWidth="1.5" />
      <path d="M23 47V17h12.5c6.2 0 10 3.4 10 9s-3.8 9-10 9H23" fill="none" stroke="#c9a96a" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
