import { describe, expect, it } from "vitest";
import { mapReservationError } from "./reservation-errors";

describe("mapReservationError", () => {
  it("maps quota, duplicate, ownership and not-found", () => {
    expect(mapReservationError({ code: "23514" }).status).toBe(409);
    expect(mapReservationError({ code: "23505" }).message).toContain("already");
    expect(mapReservationError({ code: "42501" }).status).toBe(403);
    expect(mapReservationError({ code: "P0002" }).status).toBe(404);
  });
  it("passes through business-rule messages and hides unknown errors", () => {
    expect(mapReservationError({ code: "P0001", message: "quote expired, request a new price" }).message).toBe("quote expired, request a new price");
    expect(mapReservationError({ code: "XX000", message: "secret detail" }).message).not.toContain("secret");
  });
});
