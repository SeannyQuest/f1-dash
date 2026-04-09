import { NextRequest, NextResponse } from "next/server";

// MultiViewer circuit API returns track outlines with x,y coordinates
// that match the OpenF1 location coordinate space
const MULTIVIEWER_API = "https://api.multiviewer.app/api/v1/circuits";

interface RawTrackPoint {
  number: number;
  letter?: string;
  angle: number;
  // Some circuits use { x, y } directly, others use { trackPosition: { x, y } }
  x?: number;
  y?: number;
  trackPosition?: { x: number; y: number };
}

export async function GET(req: NextRequest) {
  const circuitKey = req.nextUrl.searchParams.get("circuit_key");
  const year = req.nextUrl.searchParams.get("year");

  if (!circuitKey) {
    return NextResponse.json(
      { error: "circuit_key required" },
      { status: 400 },
    );
  }

  try {
    const url = `${MULTIVIEWER_API}/${circuitKey}/${year || new Date().getFullYear()}`;
    const res = await fetch(url, {
      next: { revalidate: 86400 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `MultiViewer API error: ${res.status}` },
        { status: 502 },
      );
    }

    const data = await res.json();

    // Normalize corner data — MultiViewer uses trackPosition.x/y on some circuits
    const corners = (data.corners || []).map((c: RawTrackPoint) => ({
      number: c.number,
      x: c.trackPosition?.x ?? c.x,
      y: c.trackPosition?.y ?? c.y,
    }));

    // Normalize marshal light positions (same trackPosition pattern as corners)
    const marshalLights = (data.marshalLights || []).map(
      (m: RawTrackPoint) => ({
        number: m.number,
        x: m.trackPosition?.x ?? m.x,
        y: m.trackPosition?.y ?? m.y,
        angle: m.angle,
      }),
    );

    return NextResponse.json(
      {
        x: data.x,
        y: data.y,
        corners,
        rotation: typeof data.rotation === "number" ? data.rotation : 0,
        marshalSectors: data.marshalSectors ?? [],
        marshalLights,
      },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=86400, stale-while-revalidate=172800",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch circuit data" },
      { status: 502 },
    );
  }
}
