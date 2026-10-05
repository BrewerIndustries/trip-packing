import { NextRequest } from "next/server";
import { body, bad, json } from "@/lib/http";
import { setRequirement } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PUT { tripTypeId, listTypeId, required } — one cell of the requirements matrix.
export async function PUT(req: NextRequest) {
  const b = await body(req);
  if (!b || typeof b.tripTypeId !== "string" || typeof b.listTypeId !== "string") {
    return bad("tripTypeId and listTypeId required");
  }
  return setRequirement(b.tripTypeId, b.listTypeId, Boolean(b.required))
    ? json({ ok: true })
    : json({ error: "not found" }, 404);
}
