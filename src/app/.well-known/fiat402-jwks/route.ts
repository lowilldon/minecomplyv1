import { NextResponse } from "next/server";
import { getJwks } from "@/lib/jwt";

export async function GET() {
  try {
    const jwks = await getJwks();
    return NextResponse.json(jwks, {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Content-Type": "application/json",
      },
    });
  } catch {
    return NextResponse.json({ error: "jwks_unavailable" }, { status: 503 });
  }
}
