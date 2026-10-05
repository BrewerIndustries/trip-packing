import { NextRequest } from "next/server";
import { body, bad, json, type Ctx } from "@/lib/http";
import { setAllPacked } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST { packed: boolean }
export async function POST(req: NextRequest, ctx: Ctx) {
  const b = await body(req);
  if (!b) return bad("invalid JSON body");
  return json({ changed: setAllPacked((await ctx.params).id, Boolean(b.packed)) });
}
