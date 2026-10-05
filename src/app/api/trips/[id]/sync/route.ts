import { NextRequest } from "next/server";
import { json, notFound, type Ctx } from "@/lib/http";
import { getTrip, previewSync, syncTrip } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET — what a sync would add. POST — apply it.
export async function GET(_req: NextRequest, ctx: Ctx) {
  const preview = previewSync((await ctx.params).id);
  return preview ? json(preview) : notFound();
}

export async function POST(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const added = syncTrip(id);
  return added ? json({ added, trip: getTrip(id) }) : notFound();
}
