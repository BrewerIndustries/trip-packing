import { NextRequest } from "next/server";
import { body, bad, json } from "@/lib/http";
import { createTrip, getTrip, listTrips } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return json({ trips: listTrips() });
}

// POST { name, destination?, tripTypeId?, startDate?, endDate?, note?, extraListTypeIds? }
export async function POST(req: NextRequest) {
  const b = await body(req);
  if (!b) return bad("invalid JSON body");
  const id = createTrip(b);
  if (!id) return bad("a trip needs a name");
  return json({ trip: getTrip(id) }, 201);
}
