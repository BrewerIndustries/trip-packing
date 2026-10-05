import { NextRequest } from "next/server";
import { body, bad, json, notFound, type Ctx } from "@/lib/http";
import { promoteTripItem } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST { listTypeId } — save this (ad hoc) item into a master list for future trips.
export async function POST(req: NextRequest, ctx: Ctx) {
  const b = await body(req);
  if (!b || typeof b.listTypeId !== "string") return bad("listTypeId required");
  const item = promoteTripItem((await ctx.params).id, b.listTypeId);
  return item ? json({ item }, 201) : notFound();
}
