import { describe, expect, it } from "vitest";
import { gstinCheckChar, isValidGstin, normaliseGstin } from "./gstin";

describe("gstin", () => {
  it("accepts a well-formed number with the right checksum", () => {
    const first14 = "27AAACP1234C1Z";
    const g = first14 + gstinCheckChar(first14);
    expect(isValidGstin(g)).toBe(true);
    expect(isValidGstin(` ${g.toLowerCase()} `)).toBe(true);
  });
  it("rejects a wrong checksum, wrong shape and bad state code", () => {
    const first14 = "27AAACP1234C1Z";
    const good = first14 + gstinCheckChar(first14);
    const bad = first14 + (good.endsWith("A") ? "B" : "A");
    expect(isValidGstin(bad)).toBe(false);
    expect(isValidGstin("27AAACP1234C1")).toBe(false);
    expect(isValidGstin("99AAACP1234C1Z5")).toBe(false);
    expect(isValidGstin("")).toBe(false);
  });
  it("normalises spaces and case", () => {
    expect(normaliseGstin(" 27aaacp1234c1z5 ")).toBe("27AAACP1234C1Z5");
  });
  it("accepts a real-world example (published sample)", () => {
    expect(isValidGstin("27AAPFU0939F1ZV")).toBe(true);
  });
});
