import { NextRequest } from "next/server";
import { json } from "@/lib/http";
import { getTrip, listTrips } from "@/lib/db";
import { daysUntil, formatRange, todayIso, tripPhase } from "@/lib/trip-math";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/summary — glanceable state for the HUD tile and Jarvis:
 * the trip in progress (or the next one coming up), its packing progress and
 * what's still unpacked. `?today=YYYY-MM-DD` overrides the server's date.
 */
export function GET(req: NextRequest) {
  const today = req.nextUrl.searchParams.get("today") ?? todayIso();
  const trips = listTrips();
  const phased = trips.map((t) => ({ t, phase: tripPhase(t.startDate, t.endDate, today) }));
  const next =
    phased.find((p) => p.phase === "active") ?? phased.find((p) => p.phase === "upcoming") ?? null;

  if (!next) {
    return json({ today, next: null, upcomingCount: 0 });
  }
  const trip = getTrip(next.t.id)!;
  const remaining = trip.items
    .filter((i) => !i.packed)
    .map((i) => (i.qty > 1 ? `${i.name} ×${i.qty}` : i.name));

  return json({
    today,
    upcomingCount: phased.filter((p) => p.phase === "upcoming" || p.phase === "active").length,
    next: {
      id: trip.id,
      name: trip.name,
      destination: trip.destination,
      tripType: trip.tripTypeName,
      icon: trip.tripTypeIcon,
      phase: next.phase,
      startDate: trip.startDate,
      endDate: trip.endDate,
      dates: formatRange(trip.startDate, trip.endDate),
      daysUntil: daysUntil(trip.startDate, today),
      total: trip.total,
      packed: trip.packed,
      remaining,
      path: `/trips/${trip.id}`,
    },
  });
}
