import { NextRequest } from "next/server";
import { body, bad, json } from "@/lib/http";
import { reorder } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS = ["list_types", "trip_types", "list_items", "trip_items"] as const;

// POST { kind, ids: string[] } — ids in their new order (one sibling group).
export async function POST(req: NextRequest) {
  const b = await body(req);
  const kind = KINDS.find((k) => k === b?.kind);
  if (!b || !kind || !Array.isArray(b.ids)) return bad("kind + ids required");
  return reorder(kind, b.ids as string[]) ? json({ ok: true }) : bad("nothing to reorder");
}
