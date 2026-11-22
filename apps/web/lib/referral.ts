/** Referral programme settings. Integer paise. Pilot amounts: change here (and in the marketing copy) before launch. */
export const REFERRAL_GIVE_PAISE = 10_000; // credit for the driver who invited a friend
export const REFERRAL_GET_PAISE = 10_000; // credit for the friend
export const REFERRAL_MIN_BOOKING_PAISE = 5_000; // the friend's first confirmed booking must be at least this much
export const REF_COOKIE = "pw_ref";
const CODE_RE = /^[A-Z0-9]{6,10}$/;

/** Upper-cases and validates a code from a link or a form. Returns null when it cannot be a code. */
export function normaliseCode(input: string | null | undefined): string | null {
  const c = (input ?? "").trim().toUpperCase();
  return CODE_RE.test(c) ? c : null;
}

export const referralLink = (origin: string, code: string) => `${origin.replace(/\/$/, "")}/r/${code}`;
export const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
