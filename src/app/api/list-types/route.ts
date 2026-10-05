import { NextRequest } from "next/server";
import { body, bad, json } from "@/lib/http";
import { createListType, listListTypes } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return json({ listTypes: listListTypes() });
}

// POST { name, icon?, color? }
export async function POST(req: NextRequest) {
  const b = await body(req);
  if (!b) return bad("invalid JSON body");
  const id = createListType(b);
  return id ? json({ id }, 201) : bad("a list needs a name");
}
