const CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const SHAPE = /^(0[1-9]|[1-2][0-9]|3[0-8])[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** The 15th character of a GSTIN, from the first 14 (the official base-36 checksum). */
export function gstinCheckChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = CHARS.indexOf(first14[i]!) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(v / 36) + (v % 36);
  }
  return CHARS[(36 - (sum % 36)) % 36]!;
}

export function normaliseGstin(s: string): string {
  return s.replace(/\s+/g, "").toUpperCase();
}

/**
 * True when the string is a well-formed GSTIN with a correct checksum. This proves the number was typed correctly,
 * NOT that it belongs to the business: a platform admin still verifies each operator against the GST portal.
 */
export function isValidGstin(raw: string): boolean {
  const s = normaliseGstin(raw);
  return SHAPE.test(s) && gstinCheckChar(s.slice(0, 14)) === s[14];
}
