import { NextRequest } from "next/server";
import { body, bad, json, type Ctx } from "@/lib/http";
import { addTripItem } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST { name, qty?, perDay?, note?, tripListId? } — an ad hoc item (no tripListId → Extras).
// perDay: true makes qty a per-day amount that scales with the trip length.
export async function POST(req: NextRequest, ctx: Ctx) {
  const b = await body(req);
  if (!b) return bad("invalid JSON body");
  const item = addTripItem((await ctx.params).id, b);
  return item ? json({ item }, 201) : bad("needs a name and an existing trip/section");
}
