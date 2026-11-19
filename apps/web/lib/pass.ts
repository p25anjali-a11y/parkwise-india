import { createHmac, timingSafeEqual } from "node:crypto";

const mac = (id: string, secret: string) => createHmac("sha256", secret).update(`pass:${id}`).digest("hex").slice(0, 16);

/** Text encoded in the QR entry pass: PW1.<reservation id>.<signature>. The signature stops anyone inventing a pass. */
export function signPass(reservationId: string, secret: string): string {
  return `PW1.${reservationId}.${mac(reservationId, secret)}`;
}

/** Returns the reservation id when the code is genuine, otherwise null. */
export function verifyPass(code: string, secret: string): string | null {
  const m = /^PW1\.([0-9a-f-]{36})\.([0-9a-f]{16})$/.exec(code.trim());
  if (!m) return null;
  const a = Buffer.from(m[2]!), b = Buffer.from(mac(m[1]!, secret));
  return a.length === b.length && timingSafeEqual(a, b) ? m[1]! : null;
}
