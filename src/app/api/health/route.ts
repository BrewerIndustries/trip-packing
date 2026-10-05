import { json } from "@/lib/http";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  getDb().prepare("SELECT 1").get();
  return json({ ok: true });
}
