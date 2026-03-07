import { NextRequest, NextResponse } from "next/server";
import { fetchOpenF1 } from "@/lib/openf1";
import type { Session } from "@/types";

export async function GET(req: NextRequest) {
  const meetingKey = req.nextUrl.searchParams.get("meeting_key");
  if (!meetingKey) {
    return NextResponse.json({ error: "meeting_key required" }, { status: 400 });
  }
  try {
    const data = await fetchOpenF1<Session[]>("sessions", { meeting_key: meetingKey }, { revalidate: 3600 });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 502 });
  }
}
