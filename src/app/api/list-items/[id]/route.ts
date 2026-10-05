import { NextRequest } from "next/server";
import { body, bad, json, notFound, type Ctx } from "@/lib/http";
import { deleteListItem, updateListItem } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH { name?, qty?, perDay?, note? }
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const b = await body(req);
  if (!b) return bad("invalid JSON body");
  return updateListItem((await ctx.params).id, b) ? json({ ok: true }) : notFound();
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return deleteListItem((await ctx.params).id) ? json({ ok: true }) : notFound();
}
