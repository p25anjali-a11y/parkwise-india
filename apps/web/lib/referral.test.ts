import { describe, expect, it } from "vitest";
import { normaliseCode, referralLink, rupees } from "./referral";

describe("referral helpers", () => {
  it("accepts 6 to 10 letters and digits, upper-cased", () => {
    expect(normaliseCode(" ab12cd34 ")).toBe("AB12CD34");
    expect(normaliseCode("ABC12")).toBeNull();
    expect(normaliseCode("ABCDEFGHIJK")).toBeNull();
  });
  it("rejects anything that could be markup or a path", () => {
    expect(normaliseCode("../etc/passwd")).toBeNull();
    expect(normaliseCode("<script>")).toBeNull();
    expect(normaliseCode(null)).toBeNull();
  });
  it("builds a link without a double slash", () => {
    expect(referralLink("https://x.test/", "AB12CD34")).toBe("https://x.test/r/AB12CD34");
  });
  it("formats paise as rupees", () => {
    expect(rupees(10_000)).toBe("₹100");
    expect(rupees(125_000)).toBe("₹1,250");
  });
});
