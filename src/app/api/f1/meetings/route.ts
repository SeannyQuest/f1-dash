import { NextRequest, NextResponse } from "next/server";
import { fetchOpenF1 } from "@/lib/openf1";
import type { Meeting } from "@/types";

export async function GET(req: NextRequest) {
  const year = req.nextUrl.searchParams.get("year") ?? new Date().getFullYear().toString();
  try {
    const data = await fetchOpenF1<Meeting[]>("meetings", { year }, { revalidate: 3600 });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch meetings" }, { status: 502 });
  }
}
