import { NextRequest, NextResponse } from "next/server";
import { fetchOpenF1 } from "@/lib/openf1";
import type { Stint } from "@/types";

export async function GET(req: NextRequest) {
  const sessionKey = req.nextUrl.searchParams.get("session_key");
  if (!sessionKey) {
    return NextResponse.json({ error: "session_key required" }, { status: 400 });
  }
  try {
    const data = await fetchOpenF1<Stint[]>("stints", { session_key: sessionKey }, { revalidate: 10 });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20" },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch stints" }, { status: 502 });
  }
}
