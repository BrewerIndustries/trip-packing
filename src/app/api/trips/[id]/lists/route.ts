import { NextRequest } from "next/server";
import { body, bad, json, type Ctx } from "@/lib/http";
import { attachList, getTrip } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST { listTypeId } — copy a whole list onto this trip.
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const b = await body(req);
  if (!b || typeof b.listTypeId !== "string") return bad("listTypeId required");
  const tl = attachList(id, b.listTypeId);
  if (!tl) return bad("unknown trip/list, or the list is already on this trip");
  return json({ trip: getTrip(id) }, 201);
}
