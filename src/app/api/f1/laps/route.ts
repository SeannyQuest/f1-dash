import { NextRequest, NextResponse } from "next/server";
import { fetchOpenF1 } from "@/lib/openf1";
import type { Lap } from "@/types";

export async function GET(req: NextRequest) {
  const sessionKey = req.nextUrl.searchParams.get("session_key");
  const driverNumber = req.nextUrl.searchParams.get("driver_number");
  if (!sessionKey) {
    return NextResponse.json({ error: "session_key required" }, { status: 400 });
  }
  const params: Record<string, string> = { session_key: sessionKey };
  if (driverNumber) params.driver_number = driverNumber;
  try {
    const data = await fetchOpenF1<Lap[]>("laps", params, { revalidate: 5 });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10" },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch laps" }, { status: 502 });
  }
}
