import { NextRequest, NextResponse } from "next/server";

const F1_STATIC_BASE = "https://livetiming.formula1.com/static";

interface F1Meeting {
  Key: number;
  Name: string;
  Location: string;
  Circuit: { Key: number; ShortName: string };
  Sessions: Array<{
    Key: number;
    Type: string;
    Name: string;
    Path?: string;
    StartDate: string;
    EndDate: string;
  }>;
}

interface F1YearIndex {
  Year: number;
  Meetings: F1Meeting[];
}

/**
 * Returns all sessions with archive data available for a given year.
 * Sessions without a Path field have no archived data yet.
 */
export async function GET(req: NextRequest) {
  const year = req.nextUrl.searchParams.get("year") || String(new Date().getFullYear());

  try {
    const res = await fetch(`${F1_STATIC_BASE}/${year}/Index.json`, {
      next: { revalidate: 300 }, // Cache for 5 min
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `F1 archive returned ${res.status}` },
        { status: res.status === 404 ? 404 : 502 },
      );
    }

    const text = await res.text();
    const cleaned = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
    const data: F1YearIndex = JSON.parse(cleaned);

    // Flatten meetings → sessions with archive paths
    const sessions = data.Meetings.flatMap((meeting) =>
      meeting.Sessions.filter((s) => s.Path).map((s) => ({
        sessionKey: s.Key,
        sessionType: s.Type,
        sessionName: s.Name,
        path: s.Path!,
        startDate: s.StartDate,
        endDate: s.EndDate,
        meetingKey: meeting.Key,
        meetingName: meeting.Name,
        location: meeting.Location,
        circuitKey: meeting.Circuit.Key,
        circuitShortName: meeting.Circuit.ShortName,
        year: data.Year,
      })),
    );

    return NextResponse.json(
      { sessions },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch F1 archive index" },
      { status: 502 },
    );
  }
}
