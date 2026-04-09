import { NextRequest, NextResponse } from "next/server";
import { fetchOpenF1, RateLimitError } from "@/lib/openf1";
import { fetchRaces } from "@/lib/jolpica";
import { getCircuitKey } from "@/lib/circuit-keys";
import type { Session } from "@/types";

function rateLimitResponse() {
  return NextResponse.json(
    { error: "Rate limit exceeded. Try again shortly." },
    { status: 429, headers: { "Retry-After": "30" } },
  );
}

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
};

/**
 * Detect synthetic Jolpica meeting keys (year * 100 + round, e.g. 202601).
 * OpenF1 meeting keys are in the ~1000-1400 range, so anything >= 200000 is Jolpica.
 */
function isJolpicaKey(key: string): boolean {
  const n = parseInt(key, 10);
  return !isNaN(n) && n >= 200000;
}

function decodeJolpicaKey(key: string): { year: string; round: number } {
  const n = parseInt(key, 10);
  return { year: String(Math.floor(n / 100)), round: n % 100 };
}

/**
 * Build Session[] from Jolpica race data for a specific round.
 * Does a single OpenF1 lookup to resolve session_keys (cached for 1hr).
 */
async function buildJolpicaSessions(
  year: string,
  round: number,
): Promise<Session[]> {
  const races = await fetchRaces(year);
  const race = races.find((r) => parseInt(r.round, 10) === round);
  if (!race) return [];

  const circuitKey = getCircuitKey(race.Circuit.circuitId) ?? 0;
  const circuitShortName = race.Circuit.Location.locality;
  const countryName = race.Circuit.Location.country;
  const yearNum = parseInt(year, 10);

  // Build session list from Jolpica race data
  type SessionEntry = {
    name: string;
    type: string;
    date: string;
    time: string;
  };
  const entries: SessionEntry[] = [];

  if (race.FirstPractice) {
    entries.push({
      name: "Practice 1",
      type: "Practice",
      date: race.FirstPractice.date,
      time: race.FirstPractice.time,
    });
  }
  if (race.SecondPractice) {
    entries.push({
      name: "Practice 2",
      type: "Practice",
      date: race.SecondPractice.date,
      time: race.SecondPractice.time,
    });
  }
  if (race.ThirdPractice) {
    entries.push({
      name: "Practice 3",
      type: "Practice",
      date: race.ThirdPractice.date,
      time: race.ThirdPractice.time,
    });
  }
  if (race.SprintQualifying) {
    entries.push({
      name: "Sprint Qualifying",
      type: "Qualifying",
      date: race.SprintQualifying.date,
      time: race.SprintQualifying.time,
    });
  }
  if (race.Sprint) {
    entries.push({
      name: "Sprint",
      type: "Race",
      date: race.Sprint.date,
      time: race.Sprint.time,
    });
  }
  if (race.Qualifying) {
    entries.push({
      name: "Qualifying",
      type: "Qualifying",
      date: race.Qualifying.date,
      time: race.Qualifying.time,
    });
  }
  entries.push({
    name: "Race",
    type: "Race",
    date: race.date,
    time: race.time,
  });

  // Try to resolve OpenF1 session_keys for data panel compatibility.
  // This is a single cached request per meeting.
  let openF1Sessions: Session[] = [];
  try {
    // Find the OpenF1 meeting for this round by fetching all meetings for the
    // year and matching on the race name or date.
    const openF1Meetings = await fetchOpenF1<
      Array<{ meeting_key: number; meeting_name: string; date_start: string }>
    >("meetings", { year }, { revalidate: 3600 });

    const raceDate = race.date;
    const match = openF1Meetings.find(
      (m) =>
        m.meeting_name === race.raceName ||
        m.date_start?.startsWith(raceDate),
    );

    if (match) {
      openF1Sessions = await fetchOpenF1<Session[]>(
        "sessions",
        { meeting_key: String(match.meeting_key) },
        { revalidate: 3600 },
      );
    }
  } catch {
    // OpenF1 unavailable — sessions will have synthetic keys (0).
    // The app can still show the track map; data panels need SignalR.
  }

  // Merge: use OpenF1 session_key if we found a matching session, else 0
  return entries.map((entry, i) => {
    const of1Match = openF1Sessions.find(
      (s) => s.session_name === entry.name,
    );
    return {
      session_key: of1Match?.session_key ?? 0,
      session_name: entry.name,
      session_type: entry.type,
      meeting_key: yearNum * 100 + round,
      date_start: `${entry.date}T${entry.time}`,
      date_end: `${entry.date}T${entry.time}`,
      gmt_offset: "00:00:00",
      year: yearNum,
      circuit_key: circuitKey,
      circuit_short_name: circuitShortName,
      country_name: countryName,
    };
  });
}

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
      return NextResponse.json(data, { headers: CACHE_HEADERS });
    } catch (e) {
      if (e instanceof RateLimitError) return rateLimitResponse();
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

  // Jolpica-sourced meeting key (year * 100 + round)
  if (isJolpicaKey(meetingKey)) {
    try {
      const { year, round } = decodeJolpicaKey(meetingKey);
      const sessions = await buildJolpicaSessions(year, round);
      return NextResponse.json(sessions, { headers: CACHE_HEADERS });
    } catch (e) {
      console.error("Jolpica sessions error:", e);
      return NextResponse.json(
        { error: "Failed to fetch sessions" },
        { status: 502 },
      );
    }
  }

  // OpenF1 meeting key (legacy / fallback)
  try {
    const data = await fetchOpenF1<Session[]>(
      "sessions",
      { meeting_key: meetingKey },
      { revalidate: 3600 },
    );
    return NextResponse.json(data, { headers: CACHE_HEADERS });
  } catch (e) {
    if (e instanceof RateLimitError) return rateLimitResponse();
    return NextResponse.json(
      { error: "Failed to fetch sessions" },
      { status: 502 },
    );
  }
}
