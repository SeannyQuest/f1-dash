import { NextRequest, NextResponse } from "next/server";
import { fetchOpenF1 } from "@/lib/openf1";
import type { Session } from "@/types";

export async function GET(req: NextRequest) {
  const meetingKey = req.nextUrl.searchParams.get("meeting_key");
  const sessionKeyOverride = req.nextUrl.searchParams.get(
    "session_key_override",
  );

  // Allow lookup by session_key directly (used by TrackMap to get circuit_key)
  if (sessionKeyOverride) {
    try {
      const data = await fetchOpenF1<Session[]>(
        "sessions",
        { session_key: sessionKeyOverride },
        { revalidate: 3600 },
      );
      return NextResponse.json(data, {
        headers: {
          "Cache-Control":
            "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      });
    } catch {
      return NextResponse.json(
        { error: "Failed to fetch session" },
        { status: 502 },
      );
    }
  }

  if (!meetingKey) {
    return NextResponse.json(
      { error: "meeting_key required" },
      { status: 400 },
    );
  }
  try {
    const data = await fetchOpenF1<Session[]>(
      "sessions",
      { meeting_key: meetingKey },
      { revalidate: 3600 },
    );
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch sessions" },
      { status: 502 },
    );
  }
}
