import { NextRequest } from "next/server";
import { json, notFound, type Ctx } from "@/lib/http";
import { detachList } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return detachList((await ctx.params).id) ? json({ ok: true }) : notFound();
}
