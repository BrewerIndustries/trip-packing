import { NextRequest } from "next/server";
import { body, bad, json, notFound, type Ctx } from "@/lib/http";
import { deleteTripItem, updateTripItem } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH { name?, qty?, note?, packed? }
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const b = await body(req);
  if (!b) return bad("invalid JSON body");
  const item = updateTripItem((await ctx.params).id, b);
  return item ? json({ item }) : notFound();
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return deleteTripItem((await ctx.params).id) ? json({ ok: true }) : notFound();
}
