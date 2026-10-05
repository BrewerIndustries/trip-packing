import { NextRequest } from "next/server";
import { body, bad, json } from "@/lib/http";
import { createTripType, listTripTypes } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return json({ tripTypes: listTripTypes() });
}

// POST { name, icon?, listTypeIds? }
export async function POST(req: NextRequest) {
  const b = await body(req);
  if (!b) return bad("invalid JSON body");
  const id = createTripType(b);
  return id ? json({ id }, 201) : bad("a trip type needs a name");
}
