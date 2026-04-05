import { NextRequest, NextResponse } from "next/server";
import { fetchOpenF1 } from "@/lib/openf1";

interface OpenF1TeamRadio {
  session_key: number;
  meeting_key: number;
  driver_number: number;
  date: string;
  recording_url: string;
}

/**
 * Team radio fallback. F1's CDN 403s TeamRadio.jsonStream for public clients,
 * so this proxies OpenF1's team_radio endpoint — which returns the same
 * captures with direct recording_url links to publicly-accessible mp3 files.
 */
export async function GET(req: NextRequest) {
  const sessionKey = req.nextUrl.searchParams.get("session_key");
  if (!sessionKey) {
    return NextResponse.json(
      { error: "session_key required" },
      { status: 400 },
    );
  }
  try {
    const data = await fetchOpenF1<OpenF1TeamRadio[]>(
      "team_radio",
      { session_key: sessionKey },
      { revalidate: 60 },
    );
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600" },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch team radio" },
      { status: 502 },
    );
  }
}
