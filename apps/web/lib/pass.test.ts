import { describe, expect, it } from "vitest";
import { signPass, verifyPass } from "./pass";

const id = "11111111-2222-3333-4444-555555555555";
describe("entry pass", () => {
  it("round-trips", () => expect(verifyPass(signPass(id, "s3cret"), "s3cret")).toBe(id));
  it("rejects a wrong secret or tampered id", () => {
    expect(verifyPass(signPass(id, "s3cret"), "other")).toBeNull();
    expect(verifyPass(signPass(id, "s3cret").replace("1111", "9999"), "s3cret")).toBeNull();
    expect(verifyPass("garbage", "s3cret")).toBeNull();
  });
});
