import { NextRequest } from "next/server";
import { body, json, notFound, type Ctx } from "@/lib/http";
import { duplicateTrip, getTrip } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST { name?, destination?, startDate?, endDate? } — same checklist, all unpacked.
export async function POST(req: NextRequest, ctx: Ctx) {
  const b = (await body(req)) ?? {};
  const id = duplicateTrip((await ctx.params).id, b);
  return id ? json({ trip: getTrip(id) }, 201) : notFound();
}
