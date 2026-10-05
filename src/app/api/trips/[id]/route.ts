import { NextRequest } from "next/server";
import { body, bad, json, notFound, type Ctx } from "@/lib/http";
import { deleteTrip, getTrip, updateTrip } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: Ctx) {
  const trip = getTrip((await ctx.params).id);
  return trip ? json({ trip }) : notFound();
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const b = await body(req);
  if (!b) return bad("invalid JSON body");
  return updateTrip(id, b) ? json({ trip: getTrip(id) }) : notFound();
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return deleteTrip((await ctx.params).id) ? json({ ok: true }) : notFound();
}
