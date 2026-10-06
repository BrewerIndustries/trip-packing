import { NextRequest } from "next/server";
import { bad, body, json, notFound, type Ctx } from "@/lib/http";
import { dismissSuggestion, resetDismissedSuggestions, suggestionsFor } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET — suggested items for this trip (history + common-sense), best first.
export async function GET(_req: NextRequest, ctx: Ctx) {
  const suggestions = suggestionsFor((await ctx.params).id);
  return suggestions ? json({ suggestions }) : notFound();
}

// POST { dismiss: key } — hide one suggestion on this trip.
export async function POST(req: NextRequest, ctx: Ctx) {
  const b = await body(req);
  if (!b || typeof b.dismiss !== "string") return bad("dismiss (a suggestion key) required");
  return dismissSuggestion((await ctx.params).id, b.dismiss) ? json({ ok: true }) : notFound();
}

// DELETE — bring back every dismissed suggestion on this trip.
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return json({ restored: resetDismissedSuggestions((await ctx.params).id) });
}
