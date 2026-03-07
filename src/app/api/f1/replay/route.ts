import { NextRequest, NextResponse } from "next/server";

const F1_STATIC_BASE = "https://livetiming.formula1.com/static";

/**
 * Proxy for F1's static timing data archive.
 * F1's server has no CORS headers, so we proxy through our API.
 *
 * Usage:
 *   /api/f1/replay?path=2026/2026-03-08_Australian_Grand_Prix/2026-03-06_Practice_1/TimingData.jsonStream
 *   /api/f1/replay?path=2026/Index.json
 */
export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("path");

  if (!path) {
    return NextResponse.json({ error: "path required" }, { status: 400 });
  }

  // Validate path: only allow safe characters (letters, numbers, dashes, underscores, dots, slashes)
  if (!/^[\w.\-/]+$/.test(path)) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 });
  }

  try {
    const url = `${F1_STATIC_BASE}/${path}`;
    const res = await fetch(url, {
      next: { revalidate: 3600 }, // Cache for 1 hour — archive data doesn't change
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `F1 archive returned ${res.status}` },
        { status: res.status === 404 ? 404 : 502 },
      );
    }

    const text = await res.text();

    return new NextResponse(text, {
      headers: {
        "Content-Type": res.headers.get("content-type") || "text/plain",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch from F1 archive" },
      { status: 502 },
    );
  }
}
