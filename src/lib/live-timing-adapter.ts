/**
 * Transforms raw F1 SignalR state into the flat types our components expect.
 *
 * IMPORTANT: The SignalR feed nests per-driver data under `.Lines` sub-objects:
 *   - TimingData.Lines["1"] = timing for driver #1
 *   - TimingAppData.Lines["1"] = stint data for driver #1
 *   - TimingStats.Lines["1"] = stats for driver #1
 *   - RaceControlMessages.Messages["35"] = message #35
 */

import type {
  Driver,
  Lap,
  Position,
  Interval,
  Stint,
  Weather,
  RaceControlMessage,
} from "@/types";
import type { DriverLocation } from "@/hooks/useWebSocket";

// Raw SignalR state shape (from relay server)
export interface F1LiveState {
  TimingData: {
    Lines?: Record<string, RawTimingDriver>;
    SessionPart?: number;
    [key: string]: unknown;
  };
  TimingStats: {
    Lines?: Record<string, RawTimingStats>;
    [key: string]: unknown;
  };
  TimingAppData: {
    Lines?: Record<string, RawTimingAppDriver>;
    [key: string]: unknown;
  };
  Position: RawPositionData | null;
  CarData: RawCarData | null;
  WeatherData: Record<string, string>;
  TrackStatus: Record<string, string>;
  DriverList: Record<string, RawDriver>;
  RaceControlMessages: {
    Messages?: Record<string, RawRCM>;
    [key: string]: unknown;
  };
  SessionInfo: Record<string, unknown>;
  SessionData: Record<string, unknown>;
  ExtrapolatedClock: Record<string, unknown>;
  LapCount: { CurrentLap?: number; TotalLaps?: number };
  TopThree: Record<string, unknown>;
  TeamRadio: Record<string, unknown>;
  Heartbeat: unknown;
  _lastUpdate: number;
}

interface RawDriver {
  RacingNumber?: string;
  BroadcastName?: string;
  FullName?: string;
  Tla?: string;
  FirstName?: string;
  LastName?: string;
  TeamName?: string;
  TeamColour?: string;
  CountryCode?: string;
  HeadshotUrl?: string;
}

interface RawTimingDriver {
  Position?: string;
  GapToLeader?: string;
  IntervalToPositionAhead?: { Value?: string };
  Sectors?: Record<
    string,
    { Value?: string; PersonalFastest?: boolean; OverallFastest?: boolean }
  >;
  Speeds?: Record<string, { Value?: string }>;
  BestLapTime?: { Value?: string };
  BestLapTimes?: Record<string, { Value?: string; Lap?: number }>;
  LastLapTime?: {
    Value?: string;
    PersonalFastest?: boolean;
    OverallFastest?: boolean;
  };
  NumberOfLaps?: number;
  Stats?: Record<
    string,
    { TimeDiffToFastest?: string; TimeDifftoPositionAhead?: string }
  >;
  InPit?: boolean;
  PitOut?: boolean;
  KnockedOut?: boolean;
  Retired?: boolean;
  Stopped?: boolean;
}

interface RawTimingStats {
  PersonalBestLapTime?: { Value?: string; Lap?: number; Position?: number };
  BestSectors?: Record<string, { Value?: string; Position?: number }>;
  BestSpeeds?: Record<string, { Value?: string; Position?: number }>;
}

interface RawTimingAppDriver {
  Stints?: Record<
    string,
    {
      Compound?: string;
      New?: string;
      TotalLaps?: number;
      StartLaps?: number;
      LapNumber?: number;
      LapTime?: string;
    }
  >;
  CurrentTyreStartLap?: number;
}

interface RawRCM {
  Category?: string;
  Flag?: string;
  Message?: string;
  Lap?: number;
  RacingNumber?: string;
  Scope?: string;
  Sector?: string;
  Utc?: string;
}

interface RawPositionData {
  Position?: Array<{
    Timestamp?: string;
    Entries?: Record<
      string,
      { X: number; Y: number; Z: number; Status?: string }
    >;
  }>;
}

interface RawCarData {
  Entries?: Array<{
    Utc?: string;
    Cars?: Record<string, { Channels?: Record<string, number> }>;
  }>;
}

// ── Helper to get Lines from a topic ──

function getLines<T>(
  topic: { Lines?: Record<string, T> } | Record<string, unknown>,
): Record<string, T> {
  const t = topic as { Lines?: Record<string, T> };
  return t.Lines ?? ({} as Record<string, T>);
}

// ── Adapter functions ──

export function adaptDrivers(state: F1LiveState, sessionKey: number): Driver[] {
  const drivers: Driver[] = [];

  for (const [num, raw] of Object.entries(state.DriverList)) {
    if (!raw.Tla) continue;
    drivers.push({
      driver_number: parseInt(num, 10),
      broadcast_name: raw.BroadcastName ?? raw.FullName ?? raw.Tla ?? "",
      full_name: raw.FullName ?? "",
      name_acronym: raw.Tla ?? "",
      first_name: raw.FirstName ?? "",
      last_name: raw.LastName ?? "",
      team_name: raw.TeamName ?? "",
      team_colour: raw.TeamColour ?? "888888",
      country_code: raw.CountryCode ?? "",
      session_key: sessionKey,
      headshot_url: raw.HeadshotUrl ?? null,
    });
  }

  return drivers;
}

export function adaptPositions(
  state: F1LiveState,
  sessionKey: number,
): Position[] {
  const positions: Position[] = [];
  const now = new Date().toISOString();
  const lines = getLines<RawTimingDriver>(state.TimingData);

  for (const [num, timing] of Object.entries(lines)) {
    if (!timing.Position) continue;
    positions.push({
      driver_number: parseInt(num, 10),
      position: parseInt(timing.Position, 10),
      date: now,
      session_key: sessionKey,
      meeting_key: 0,
    });
  }

  return positions;
}

function parseTime(timeStr: string | undefined): number | null {
  if (!timeStr) return null;
  const parts = timeStr.split(":");
  if (parts.length === 2) {
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  }
  const val = parseFloat(timeStr);
  return isNaN(val) ? null : val;
}

export function adaptLaps(state: F1LiveState, sessionKey: number): Lap[] {
  const laps: Lap[] = [];
  const now = new Date().toISOString();
  const lines = getLines<RawTimingDriver>(state.TimingData);

  for (const [num, timing] of Object.entries(lines)) {
    const driverNum = parseInt(num, 10);
    const lapDuration = parseTime(timing.LastLapTime?.Value);
    const sectors = timing.Sectors ?? {};

    laps.push({
      driver_number: driverNum,
      lap_number: timing.NumberOfLaps ?? 0,
      lap_duration: lapDuration,
      duration_sector_1: parseTime(sectors["0"]?.Value),
      duration_sector_2: parseTime(sectors["1"]?.Value),
      duration_sector_3: parseTime(sectors["2"]?.Value),
      i1_speed: null,
      i2_speed: null,
      st_speed: timing.Speeds?.ST?.Value
        ? parseFloat(timing.Speeds.ST.Value)
        : null,
      is_pit_out_lap: timing.PitOut ?? false,
      date_start: now,
      session_key: sessionKey,
    });
  }

  return laps;
}

export function adaptIntervals(
  state: F1LiveState,
  sessionKey: number,
): Interval[] {
  const intervals: Interval[] = [];
  const now = new Date().toISOString();
  const lines = getLines<RawTimingDriver>(state.TimingData);

  for (const [num, timing] of Object.entries(lines)) {
    const gap = timing.GapToLeader;
    const interval = timing.IntervalToPositionAhead?.Value;

    // For qualifying, gap info is in Stats keyed by session part
    let gapValue: number | null = null;
    let intValue: number | null = null;

    if (gap) {
      gapValue = parseFloat(gap.replace("+", "")) || 0;
    } else if (timing.Stats) {
      // Use the latest session part stats
      const partKeys = Object.keys(timing.Stats).sort();
      const latestPart = partKeys[partKeys.length - 1];
      if (latestPart) {
        const stat = timing.Stats[latestPart];
        if (stat?.TimeDiffToFastest) {
          gapValue =
            parseFloat(stat.TimeDiffToFastest.replace("+", "")) || null;
        }
        if (stat?.TimeDifftoPositionAhead) {
          intValue =
            parseFloat(stat.TimeDifftoPositionAhead.replace("+", "")) || null;
        }
      }
    }

    if (interval) {
      intValue = parseFloat(interval.replace("+", "")) || 0;
    }

    intervals.push({
      driver_number: parseInt(num, 10),
      gap_to_leader: gapValue,
      interval: intValue,
      date: now,
      session_key: sessionKey,
    });
  }

  return intervals;
}

export function adaptStints(state: F1LiveState, sessionKey: number): Stint[] {
  const stints: Stint[] = [];
  const lines = getLines<RawTimingAppDriver>(state.TimingAppData);

  for (const [num, appData] of Object.entries(lines)) {
    const driverNum = parseInt(num, 10);
    if (!appData.Stints) continue;

    // Stints can be an object or array — normalize to entries
    const stintEntries =
      typeof appData.Stints === "object" && !Array.isArray(appData.Stints)
        ? Object.entries(appData.Stints)
        : (appData.Stints as unknown as Array<unknown>).map(
            (s, i) =>
              [String(i), s] as [string, (typeof appData.Stints)[string]],
          );

    for (const [stintNum, stint] of stintEntries) {
      if (!stint || typeof stint !== "object") continue;
      const s = stint as {
        Compound?: string;
        New?: string;
        TotalLaps?: number;
        StartLaps?: number;
        LapNumber?: number;
      };
      stints.push({
        driver_number: driverNum,
        stint_number: parseInt(stintNum, 10) + 1,
        lap_start: s.StartLaps ?? s.LapNumber ?? 0,
        lap_end: (s.StartLaps ?? 0) + (s.TotalLaps ?? 0),
        compound: (s.Compound?.toUpperCase() ?? "UNKNOWN") as Stint["compound"],
        tyre_age_at_start: 0,
        session_key: sessionKey,
      });
    }
  }

  return stints;
}

export function adaptWeather(
  state: F1LiveState,
  sessionKey: number,
): Weather[] {
  const w = state.WeatherData;
  if (!w.AirTemp && !w.TrackTemp) return [];

  return [
    {
      air_temperature: parseFloat(w.AirTemp ?? "0"),
      humidity: parseFloat(w.Humidity ?? "0"),
      pressure: parseFloat(w.Pressure ?? "0"),
      rainfall: parseFloat(w.Rainfall ?? "0"),
      track_temperature: parseFloat(w.TrackTemp ?? "0"),
      wind_direction: parseFloat(w.WindDirection ?? "0"),
      wind_speed: parseFloat(w.WindSpeed ?? "0"),
      date: new Date().toISOString(),
      session_key: sessionKey,
      meeting_key: 0,
    },
  ];
}

export function adaptRaceControl(
  state: F1LiveState,
  sessionKey: number,
): RaceControlMessage[] {
  const messages: RaceControlMessage[] = [];

  // Messages are nested under RaceControlMessages.Messages
  const rcm = state.RaceControlMessages;
  const msgObj =
    (rcm.Messages as Record<string, RawRCM> | undefined) ??
    ({} as Record<string, RawRCM>);

  for (const [, msg] of Object.entries(msgObj)) {
    if (!msg.Message) continue;
    messages.push({
      date: msg.Utc ?? new Date().toISOString(),
      category: msg.Category ?? "",
      flag: msg.Flag,
      message: msg.Message,
      scope: msg.Scope,
      sector: msg.Sector ? parseInt(msg.Sector, 10) : undefined,
      driver_number: msg.RacingNumber
        ? parseInt(msg.RacingNumber, 10)
        : undefined,
      lap_number: msg.Lap,
      session_key: sessionKey,
      meeting_key: 0,
    });
  }

  return messages;
}

export function adaptTrackPositions(state: F1LiveState): DriverLocation[] {
  if (!state.Position) return [];

  // Position.z decompresses to either:
  //   a) Array of {Timestamp, Entries} directly
  //   b) {Position: [{Timestamp, Entries}]} wrapper
  type PosEntry = {
    Timestamp?: string;
    Entries?: Record<string, { X: number; Y: number; Z: number }>;
  };

  let posArray: PosEntry[] | null = null;

  if (Array.isArray(state.Position)) {
    posArray = state.Position as unknown as PosEntry[];
  } else if (
    state.Position &&
    typeof state.Position === "object" &&
    "Position" in state.Position &&
    Array.isArray((state.Position as RawPositionData).Position)
  ) {
    posArray = (state.Position as RawPositionData).Position as PosEntry[];
  }

  if (!posArray || posArray.length === 0) return [];

  // Use the latest position entry
  const latest = posArray[posArray.length - 1];
  if (!latest?.Entries) return [];

  const locations: DriverLocation[] = [];
  for (const [num, entry] of Object.entries(latest.Entries)) {
    locations.push({
      driver_number: parseInt(num, 10),
      x: entry.X,
      y: entry.Y,
      z: entry.Z,
      date: latest.Timestamp ?? new Date().toISOString(),
    });
  }

  return locations;
}
