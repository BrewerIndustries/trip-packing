import { NextRequest, NextResponse } from "next/server";

// Tiny helpers shared by the route handlers. There is no auth layer: the app is
// tailnet-only (nginx allows 100.64.0.0/10 and the DNS points at the Tailscale
// address), so anyone who can reach it is already on the owner's tailnet.

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status });
export const notFound = () => json({ error: "not found" }, 404);
export const bad = (error: string) => json({ error }, 400);

export async function body(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const v = await req.json();
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export type Ctx = { params: Promise<{ id: string }> };
