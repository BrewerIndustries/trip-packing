import { NextRequest } from "next/server";
import { body, bad, json, type Ctx } from "@/lib/http";
import { createListItem } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST { name, qty?, perDay?, note? }
export async function POST(req: NextRequest, ctx: Ctx) {
  const b = await body(req);
  if (!b) return bad("invalid JSON body");
  const item = createListItem((await ctx.params).id, b);
  return item ? json({ item }, 201) : bad("needs a name and an existing list");
}
