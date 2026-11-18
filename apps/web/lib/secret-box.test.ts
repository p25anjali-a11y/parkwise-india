import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, newFeedSecret } from "./secret-box";

const K = randomBytes(32).toString("base64");

describe("secret box", () => {
  it("round-trips and uses a fresh IV each time", () => {
    const a = encryptSecret("pws_abc", K);
    const b = encryptSecret("pws_abc", K);
    expect(a).not.toBe(b);
    expect(decryptSecret(a, K)).toBe("pws_abc");
  });
  it("fails on tampering and on the wrong key", () => {
    const a = Buffer.from(encryptSecret("pws_abc", K), "base64");
    a[a.length - 1] = a[a.length - 1]! ^ 1;
    expect(() => decryptSecret(a.toString("base64"), K)).toThrow();
    expect(() => decryptSecret(encryptSecret("x", K), randomBytes(32).toString("base64"))).toThrow();
  });
  it("refuses a missing or short key", () => {
    expect(() => encryptSecret("x", undefined)).toThrow("32 bytes");
    expect(() => encryptSecret("x", "c2hvcnQ=")).toThrow("32 bytes");
  });
  it("generates prefixed random secrets", () => {
    const s = newFeedSecret();
    expect(s.secret.startsWith("pws_")).toBe(true);
    expect(s.prefix).toBe(s.secret.slice(0, 8));
    expect(newFeedSecret().secret).not.toBe(s.secret);
  });
});
