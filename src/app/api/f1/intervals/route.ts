import { NextRequest, NextResponse } from "next/server";
import { fetchOpenF1 } from "@/lib/openf1";
import type { Interval } from "@/types";

export async function GET(req: NextRequest) {
  const sessionKey = req.nextUrl.searchParams.get("session_key");
  if (!sessionKey) {
    return NextResponse.json({ error: "session_key required" }, { status: 400 });
  }
  try {
    const data = await fetchOpenF1<Interval[]>("intervals", { session_key: sessionKey }, { revalidate: 3 });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=3, stale-while-revalidate=6" },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch intervals" }, { status: 502 });
  }
}
