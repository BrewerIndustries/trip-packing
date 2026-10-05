// Pure date/quantity helpers — no DB, no Node APIs, so they're unit-testable and
// safe to import from client components.

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(s: unknown): s is string {
  if (typeof s !== "string" || !ISO.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * Number of days a trip covers, counting both ends (Fri→Sun = 3). Missing or
 * inverted dates fall back to 1 so per-day items still get a sane quantity.
 */
export function tripDays(start: string | null, end: string | null): number {
  if (!isIsoDate(start)) return 1;
  if (!isIsoDate(end)) return 1;
  const ms = Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`);
  const days = Math.round(ms / 86_400_000) + 1;
  return days >= 1 ? days : 1;
}

/** Quantity to pack for a master item on a trip of `days` days. */
export function packQty(qty: number, perDay: boolean, days: number): number {
  const base = Math.max(1, Math.round(qty) || 1);
  return perDay ? base * Math.max(1, days) : base;
}

/** Local-calendar YYYY-MM-DD for "today" (server TZ for SSR, device TZ in the browser). */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type TripPhase = "upcoming" | "active" | "past" | "undated";

export function tripPhase(start: string | null, end: string | null, today: string): TripPhase {
  const s = isIsoDate(start) ? start : null;
  const e = isIsoDate(end) ? end : s;
  if (!s) return "undated";
  if (e && e < today) return "past";
  if (s > today) return "upcoming";
  return "active";
}

/** Whole days from `today` until `start` (0 = today, negative = already started). */
export function daysUntil(start: string | null, today: string): number | null {
  if (!isIsoDate(start)) return null;
  return Math.round((Date.parse(`${start}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Oct 9 – 12", "Oct 30 – Nov 2", "Dec 30, 2026 – Jan 2, 2027", or "" when undated. */
export function formatRange(start: string | null, end: string | null): string {
  if (!isIsoDate(start)) return "";
  const [sy, sm, sd] = start.split("-").map(Number);
  if (!isIsoDate(end) || end === start) return `${MONTHS[sm - 1]} ${sd}, ${sy}`;
  const [ey, em, ed] = end.split("-").map(Number);
  if (sy !== ey) return `${MONTHS[sm - 1]} ${sd}, ${sy} – ${MONTHS[em - 1]} ${ed}, ${ey}`;
  if (sm !== em) return `${MONTHS[sm - 1]} ${sd} – ${MONTHS[em - 1]} ${ed}, ${sy}`;
  return `${MONTHS[sm - 1]} ${sd} – ${ed}, ${sy}`;
}
