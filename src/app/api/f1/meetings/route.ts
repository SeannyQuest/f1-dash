import { NextRequest, NextResponse } from "next/server";
import { fetchRaces } from "@/lib/jolpica";
import { getCircuitKey } from "@/lib/circuit-keys";
import { fetchOpenF1, RateLimitError } from "@/lib/openf1";
import type { Meeting } from "@/types";

/**
 * Meetings route — uses Jolpica (Ergast successor) as primary source,
 * falls back to OpenF1 if Jolpica fails. Jolpica has no rate limit.
 *
 * Synthetic meeting_key = year * 100 + round (e.g. 202601 for round 1 of 2026).
 * The sessions route detects this encoding to use the correct data source.
 */

function jolpicaToMeetings(
  races: Awaited<ReturnType<typeof fetchRaces>>,
): Meeting[] {
  return races.map((race) => {
    const year = parseInt(race.season, 10);
    const round = parseInt(race.round, 10);

    // Compute date_end from race date (race day is always the last day)
    const raceDate = race.date;

    // Find earliest session date for date_start
    const sessionDates = [
      race.FirstPractice?.date,
      race.SecondPractice?.date,
      race.ThirdPractice?.date,
      race.Qualifying?.date,
      race.Sprint?.date,
      race.SprintQualifying?.date,
    ].filter(Boolean) as string[];
    const dateStart =
      sessionDates.length > 0
        ? sessionDates.sort()[0]
        : raceDate;

    return {
      meeting_key: year * 100 + round,
      meeting_name: race.raceName,
      meeting_official_name: race.raceName,
      circuit_key: getCircuitKey(race.Circuit.circuitId) ?? 0,
      circuit_short_name: race.Circuit.Location.locality,
      location: race.Circuit.Location.locality,
      country_key: 0,
      country_code: "",
      country_name: race.Circuit.Location.country,
      date_start: `${dateStart}T${race.FirstPractice?.time ?? "00:00:00Z"}`,
      date_end: `${raceDate}T${race.time ?? "00:00:00Z"}`,
      gmt_offset: "00:00:00",
      year,
    };
  });
}

export async function GET(req: NextRequest) {
  const year =
    req.nextUrl.searchParams.get("year") ??
    new Date().getFullYear().toString();

  // Primary: Jolpica (no rate limit)
  try {
    const races = await fetchRaces(year);
    const meetings = jolpicaToMeetings(races);
    return NextResponse.json(meetings, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (e) {
    console.error(
      "Jolpica meetings error, falling back to OpenF1:",
      e instanceof Error ? e.message : e,
    );
  }

  // Fallback: OpenF1
  try {
    const data = await fetchOpenF1<Meeting[]>(
      "meetings",
      { year },
      { revalidate: 3600 },
    );
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again shortly." },
        { status: 429, headers: { "Retry-After": "30" } },
      );
    }
    console.error("Meetings route error:", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "Failed to fetch meetings" },
      { status: 502 },
    );
  }
}
