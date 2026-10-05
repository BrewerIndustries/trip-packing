import { NextRequest } from "next/server";
import { body, bad, json, notFound, type Ctx } from "@/lib/http";
import { deleteTripType, updateTripType } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH { name?, icon?, listTypeIds? }
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const b = await body(req);
  if (!b) return bad("invalid JSON body");
  return updateTripType((await ctx.params).id, b) ? json({ ok: true }) : notFound();
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return deleteTripType((await ctx.params).id) ? json({ ok: true }) : notFound();
}
