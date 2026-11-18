import { describe, expect, it } from "vitest";
import { LOT_CSV_HEADER, parseLotsCsv } from "./lots";

const today = new Date("2026-11-19T00:00:00Z");
const good = '"Example Lot, Block B",Mumbai,"12 Example Rd, Bandra",mall,19.06,72.83,300,60,100,Example Operator,operator export,2026-11-10';

describe("parseLotsCsv", () => {
  it("accepts a valid row, keeps quoted commas and converts rupees to paise", () => {
    const r = parseLotsCsv(`${LOT_CSV_HEADER}\n${good}`, today);
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({ name: "Example Lot, Block B", address: "12 Example Rd, Bandra", base_rate_paise: 6000, municipal_cap_paise: 10000, car_capacity: 300 });
  });
  it("ignores comment lines and treats an empty cap as none", () => {
    const r = parseLotsCsv(`# note\n${good.replace(",100,", ",,")}`, today);
    expect(r.rows[0]?.municipal_cap_paise).toBeNull();
  });
  it.each([
    ["missing data_source", good.replace("operator export", "")],
    ["future data_as_of", good.replace("2026-11-10", "2027-01-01")],
    ["coordinates outside the city", good.replace("19.06,72.83", "28.6,77.2")],
    ["unknown city", good.replace("Mumbai", "Pune")],
    ["unknown category", good.replace("mall", "garage")],
    ["zero capacity", good.replace(",300,", ",0,")],
    ["cap below base rate", good.replace(",100,", ",40,")],
    ["wrong column count", "a,b,c"],
  ])("rejects %s", (_n, row) => {
    expect(parseLotsCsv(row, today).errors.length).toBe(1);
  });
});
