import { NextRequest, NextResponse } from "next/server";
import { fetchOpenF1 } from "@/lib/openf1";
import type { Driver } from "@/types";

export async function GET(req: NextRequest) {
  const sessionKey = req.nextUrl.searchParams.get("session_key");
  if (!sessionKey) {
    return NextResponse.json(
      { error: "session_key required" },
      { status: 400 },
    );
  }
  try {
    const data = await fetchOpenF1<Driver[]>(
      "drivers",
      { session_key: sessionKey },
      { revalidate: 60 },
    );
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch drivers" },
      { status: 502 },
    );
  }
}
