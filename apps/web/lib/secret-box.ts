import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key(env: string | undefined): Buffer {
  const k = env ? Buffer.from(env, "base64") : Buffer.alloc(0);
  if (k.length !== 32) throw new Error("FEED_ENCRYPTION_KEY must be 32 bytes, base64 encoded");
  return k;
}

/** AES-256-GCM. Output: base64(iv | tag | ciphertext). */
export function encryptSecret(plain: string, keyB64 = process.env.FEED_ENCRYPTION_KEY): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(keyB64), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString("base64");
}

export function decryptSecret(boxed: string, keyB64 = process.env.FEED_ENCRYPTION_KEY): string {
  const raw = Buffer.from(boxed, "base64");
  const d = createDecipheriv("aes-256-gcm", key(keyB64), raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
}

export function newFeedSecret(): { secret: string; prefix: string } {
  const secret = `pws_${randomBytes(32).toString("base64url")}`;
  return { secret, prefix: secret.slice(0, 8) };
}
