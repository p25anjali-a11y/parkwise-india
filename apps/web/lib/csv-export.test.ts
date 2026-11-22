import { describe, expect, it } from "vitest";
import { csvCell, dailyGross, toCsv } from "./csv-export";

describe("csv export", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("x\ny")).toBe('"x\ny"');
  });
  it("neutralises spreadsheet formulas in text but not in numbers", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("-5 off")).toBe("'-5 off");
    expect(csvCell(-5)).toBe("-5");
  });
  it("joins rows with CRLF and a trailing newline", () => {
    expect(toCsv([["a", 1], ["b", null]])).toBe("a,1\r\nb,\r\n");
  });
  it("sums only paid bookings per IST day and fills empty days", () => {
    const now = new Date("2026-11-22T10:00:00Z");
    const g = dailyGross([
      { status: "confirmed", total_paise: 5000, created_at: "2026-11-22T08:00:00Z" },
      { status: "completed", total_paise: 2500, created_at: "2026-11-22T09:00:00Z" },
      { status: "cancelled", total_paise: 9999, created_at: "2026-11-22T09:00:00Z" },
      { status: "confirmed", total_paise: 4000, created_at: "2026-11-20T09:00:00Z" },
    ], 3, now);
    expect(g.map((d) => d.paise)).toEqual([4000, 0, 7500]);
    expect(g).toHaveLength(3);
  });
  it("counts a booking made late evening UTC on the next IST day", () => {
    const now = new Date("2026-11-22T10:00:00Z");
    const g = dailyGross([{ status: "confirmed", total_paise: 100, created_at: "2026-11-21T20:00:00Z" }], 2, now);
    expect(g[1]!.paise).toBe(100); // 21 Nov 20:00 UTC = 22 Nov 01:30 IST
  });
});
