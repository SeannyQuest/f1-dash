import { NextRequest, NextResponse } from "next/server";

// MultiViewer circuit API returns track outlines with x,y coordinates
// that match the OpenF1 location coordinate space
const MULTIVIEWER_API = "https://api.multiviewer.app/api/v1/circuits";

interface CircuitResponse {
  x: number[];
  y: number[];
  corners: { number: number; letter: string; x: number; y: number; angle: number }[];
}

export async function GET(req: NextRequest) {
  const circuitKey = req.nextUrl.searchParams.get("circuit_key");
  const year = req.nextUrl.searchParams.get("year");

  if (!circuitKey) {
    return NextResponse.json({ error: "circuit_key required" }, { status: 400 });
  }

  try {
    const url = `${MULTIVIEWER_API}/${circuitKey}/${year || new Date().getFullYear()}`;
    const res = await fetch(url, {
      next: { revalidate: 86400 }, // Cache for 24h — circuit data doesn't change
    });

    if (!res.ok) {
      return NextResponse.json({ error: `MultiViewer API error: ${res.status}` }, { status: 502 });
    }

    const data: CircuitResponse = await res.json();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=172800" },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch circuit data" }, { status: 502 });
  }
}
