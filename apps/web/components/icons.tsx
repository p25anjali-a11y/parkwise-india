import type { ReactNode } from "react";

const I = (d: ReactNode, size = 22) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>
);

/** Line icons only (no emoji), shared by the bottom tab bar, the desktop nav and the operator sidebar. */
export const ICON = {
  sun: I(<><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" /></>),
  eye: I(<><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" /><circle cx="12" cy="12" r="2.8" /></>),
  eyeOff: I(<><path d="M3 3l18 18" /><path d="M10.6 5.7A9.6 9.6 0 0 1 12 5.5C18.5 5.5 22 12 22 12a17 17 0 0 1-3.2 3.9M6.3 7.3C3.9 9 2 12 2 12s3.5 6.5 10 6.5c1.4 0 2.7-.3 3.8-.8" /><path d="M9.9 9.9a2.8 2.8 0 0 0 4.2 3.7" /></>),
  moon: I(<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />),
  search: I(<><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>),
  live: I(<><path d="M3 15h18M5 15l1.6-5.2A2 2 0 0 1 8.5 8.4h7a2 2 0 0 1 1.9 1.4L19 15" /><circle cx="7.5" cy="17.5" r="1.5" /><circle cx="16.5" cy="17.5" r="1.5" /></>),
  trips: I(<><path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Z" /><path d="M14 6v12" strokeDasharray="2 2.5" /></>),
  me: I(<><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>),
  lots: I(<><path d="M4 20V8l8-4 8 4v12M9 20v-6h6v6" /></>),
  add: I(<><path d="M12 5v14M5 12h14" /></>),
  stats: I(<><path d="M5 20V11M12 20V5M19 20v-7" /></>),
  feeds: I(<><path d="M5 12a7 7 0 0 1 14 0M8.5 12a3.5 3.5 0 0 1 7 0" /><circle cx="12" cy="12" r="0.8" /><path d="M12 13v7" /></>),
  swap: I(<><path d="M7 7h12l-3-3M17 17H5l3 3" /></>),
  gift: I(<><rect x="4" y="9" width="16" height="11" rx="2" /><path d="M12 9v11M4 13h16M12 9c-2.5 0-4-1-4-2.5S9.2 4 10.5 4C12 4 12 6.5 12 9Zm0 0c2.5 0 4-1 4-2.5S14.8 4 13.5 4C12 4 12 6.5 12 9Z" /></>),
  list: I(<><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4" cy="6" r="0.9" /><circle cx="4" cy="12" r="0.9" /><circle cx="4" cy="18" r="0.9" /></>),
  grid: I(<><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></>),
  locate: I(<><circle cx="12" cy="12" r="3.5" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /></>),
  nav: I(<><path d="m4 11 16-7-7 16-2.2-6.8L4 11Z" /></>),
  share: I(<><circle cx="6" cy="12" r="2.2" /><circle cx="17" cy="6" r="2.2" /><circle cx="17" cy="18" r="2.2" /><path d="m8 11 7-4M8 13l7 4" /></>),
  copy: I(<><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></>),
  download: I(<><path d="M12 4v11M7.5 11 12 15.5 16.5 11M5 20h14" /></>),
  clock: I(<><circle cx="12" cy="12" r="8" /><path d="M12 8v4.5l3 1.5" /></>),
};
