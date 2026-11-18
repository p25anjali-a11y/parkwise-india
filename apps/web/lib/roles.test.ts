import { describe, expect, it } from "vitest";
import { canAccess, homeFor } from "./roles";

describe("roles", () => {
  it("blocks anonymous users everywhere", () => {
    expect(canAccess(null, "driver")).toBe(false);
  });
  it("keeps drivers out of operator and admin areas", () => {
    expect(canAccess("driver", "operator")).toBe(false);
    expect(canAccess("driver", "admin")).toBe(false);
  });
  it("lets operators in but not admin", () => {
    expect(canAccess("operator", "operator")).toBe(true);
    expect(canAccess("operator_admin", "admin")).toBe(false);
  });
  it("lets platform admins into everything", () => {
    expect(canAccess("platform_admin", "admin")).toBe(true);
  });
  it("routes each role home", () => {
    expect(homeFor("driver")).toBe("/driver");
    expect(homeFor("operator")).toBe("/operator");
    expect(homeFor("platform_admin")).toBe("/admin");
  });
});
