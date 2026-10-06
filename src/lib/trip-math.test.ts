import { test } from "node:test";
import assert from "node:assert/strict";
import { countOf, daysUntil, fmtAmount, formatRange, isIsoDate, packQty, perDayOf, tripDays, tripPhase } from "./trip-math.ts";

test("isIsoDate rejects impossible dates", () => {
  assert.equal(isIsoDate("2026-10-09"), true);
  assert.equal(isIsoDate("2026-02-30"), false);
  assert.equal(isIsoDate("10/09/2026"), false);
  assert.equal(isIsoDate(null), false);
});

test("tripDays counts both ends and falls back to 1", () => {
  assert.equal(tripDays("2026-10-09", "2026-10-11"), 3);
  assert.equal(tripDays("2026-10-09", "2026-10-09"), 1);
  assert.equal(tripDays("2026-10-30", "2026-11-02"), 4);
  assert.equal(tripDays("2026-10-09", null), 1);
  assert.equal(tripDays(null, null), 1);
  assert.equal(tripDays("2026-10-11", "2026-10-09"), 1);
  // DST change (US, Nov 1 2026) must not lose or gain a day
  assert.equal(tripDays("2026-10-31", "2026-11-03"), 4);
});

test("packQty multiplies per-day items only", () => {
  assert.equal(packQty(1, true, 4), 4);
  assert.equal(packQty(2, true, 3), 6);
  assert.equal(packQty(2, false, 3), 2);
  assert.equal(packQty(0, false, 3), 1);
});

test("tripPhase", () => {
  const today = "2026-10-05";
  assert.equal(tripPhase("2026-10-09", "2026-10-11", today), "upcoming");
  assert.equal(tripPhase("2026-10-04", "2026-10-06", today), "active");
  assert.equal(tripPhase("2026-10-05", null, today), "active");
  assert.equal(tripPhase("2026-10-01", "2026-10-03", today), "past");
  assert.equal(tripPhase(null, null, today), "undated");
});

test("daysUntil + formatRange", () => {
  assert.equal(daysUntil("2026-10-09", "2026-10-05"), 4);
  assert.equal(daysUntil(null, "2026-10-05"), null);
  assert.equal(formatRange("2026-10-09", "2026-10-12"), "Oct 9 – 12, 2026");
  assert.equal(formatRange("2026-10-30", "2026-11-02"), "Oct 30 – Nov 2, 2026");
  assert.equal(formatRange("2026-12-30", "2027-01-02"), "Dec 30, 2026 – Jan 2, 2027");
  assert.equal(formatRange(null, null), "");
});

test("fractional per-day amounts round the total up", () => {
  assert.equal(packQty(0.5, true, 5), 3);   // every other day over 5 days
  assert.equal(packQty(0.5, true, 4), 2);
  assert.equal(packQty(0.5, true, 1), 1);   // never below 1
  assert.equal(packQty(0.1, true, 30), 3);  // float noise: 0.1 × 30 = 3.0000000000000004
  assert.equal(packQty(1.5, true, 3), 5);
  assert.equal(packQty(2.4, false, 3), 2);  // counts stay whole
});

test("perDayOf / countOf / fmtAmount", () => {
  assert.equal(perDayOf("0.5"), 0.5);
  assert.equal(perDayOf(0.333), 0.33);
  assert.equal(perDayOf(0, 1), 1);          // below 0.1 → fallback
  assert.equal(perDayOf("abc", 2), 2);
  assert.equal(countOf(2.6), 3);
  assert.equal(countOf(0, 1), 1);
  assert.equal(fmtAmount(0.5), "0.5");
  assert.equal(fmtAmount(2), "2");
});
