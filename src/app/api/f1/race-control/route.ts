import { NextRequest, NextResponse } from "next/server";
import { fetchOpenF1 } from "@/lib/openf1";
import type { RaceControlMessage } from "@/types";

export async function GET(req: NextRequest) {
  const sessionKey = req.nextUrl.searchParams.get("session_key");
  if (!sessionKey) {
    return NextResponse.json({ error: "session_key required" }, { status: 400 });
  }
  try {
    const data = await fetchOpenF1<RaceControlMessage[]>("race_control", { session_key: sessionKey }, { revalidate: 5 });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10" },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch race control messages" }, { status: 502 });
  }
}
