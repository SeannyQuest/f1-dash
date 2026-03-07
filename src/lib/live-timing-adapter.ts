/**
 * Transforms raw F1 SignalR state into the flat types our components expect.
 * The SignalR feed uses nested objects keyed by driver number,
 * while our components expect arrays matching the OpenF1 REST API shape.
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
  TimingData: Record<string, RawTimingDriver>;
  TimingStats: Record<string, RawTimingStats>;
  TimingAppData: Record<string, RawTimingAppDriver>;
  Position: RawPositionData | null;
  CarData: RawCarData | null;
  WeatherData: Record<string, string>;
  TrackStatus: Record<string, string>;
  DriverList: Record<string, RawDriver>;
  RaceControlMessages: Record<string, RawRCM>;
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
  Tla?: string; // Three-letter abbreviation
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
  LastLapTime?: { Value?: string; PersonalFastest?: boolean; OverallFastest?: boolean };
  NumberOfLaps?: number;
  InPit?: boolean;
  PitOut?: boolean;
}

interface RawTimingStats {
  PersonalBestLapTime?: { Value?: string };
  BestSectors?: Record<string, { Value?: string }>;
  BestSpeeds?: Record<string, { Value?: string }>;
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
    Entries?: Record<string, { X: number; Y: number; Z: number; Status?: string }>;
  }>;
}

interface RawCarData {
  Entries?: Array<{
    Utc?: string;
    Cars?: Record<string, { Channels?: Record<string, number> }>;
  }>;
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

export function adaptPositions(state: F1LiveState, sessionKey: number): Position[] {
  const positions: Position[] = [];
  const now = new Date().toISOString();

  for (const [num, timing] of Object.entries(state.TimingData)) {
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
  // Format: "1:23.456" or "23.456"
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

  for (const [num, timing] of Object.entries(state.TimingData)) {
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

export function adaptIntervals(state: F1LiveState, sessionKey: number): Interval[] {
  const intervals: Interval[] = [];
  const now = new Date().toISOString();

  for (const [num, timing] of Object.entries(state.TimingData)) {
    const gap = timing.GapToLeader;
    const interval = timing.IntervalToPositionAhead?.Value;

    intervals.push({
      driver_number: parseInt(num, 10),
      gap_to_leader: gap ? parseFloat(gap.replace("+", "")) || 0 : null,
      interval: interval ? parseFloat(interval.replace("+", "")) || 0 : null,
      date: now,
      session_key: sessionKey,
    });
  }

  return intervals;
}

export function adaptStints(state: F1LiveState, sessionKey: number): Stint[] {
  const stints: Stint[] = [];

  for (const [num, appData] of Object.entries(state.TimingAppData)) {
    const driverNum = parseInt(num, 10);
    if (!appData.Stints) continue;

    for (const [stintNum, stint] of Object.entries(appData.Stints)) {
      stints.push({
        driver_number: driverNum,
        stint_number: parseInt(stintNum, 10) + 1,
        lap_start: stint.StartLaps ?? stint.LapNumber ?? 0,
        lap_end: (stint.StartLaps ?? 0) + (stint.TotalLaps ?? 0),
        compound: (stint.Compound?.toUpperCase() ?? "UNKNOWN") as Stint["compound"],
        tyre_age_at_start: 0,
        session_key: sessionKey,
      });
    }
  }

  return stints;
}

export function adaptWeather(state: F1LiveState, sessionKey: number): Weather[] {
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
  sessionKey: number
): RaceControlMessage[] {
  const messages: RaceControlMessage[] = [];

  for (const [, msg] of Object.entries(state.RaceControlMessages)) {
    // The Messages sub-object contains the actual messages
    if (!msg.Message) {
      // It might be nested under a "Messages" key
      const nested = msg as unknown as { Messages?: Record<string, RawRCM> };
      if (nested.Messages) {
        for (const [, innerMsg] of Object.entries(nested.Messages)) {
          if (innerMsg.Message) {
            messages.push({
              date: innerMsg.Utc ?? new Date().toISOString(),
              category: innerMsg.Category ?? "",
              flag: innerMsg.Flag,
              message: innerMsg.Message,
              scope: innerMsg.Scope,
              sector: innerMsg.Sector ? parseInt(innerMsg.Sector, 10) : undefined,
              driver_number: innerMsg.RacingNumber
                ? parseInt(innerMsg.RacingNumber, 10)
                : undefined,
              lap_number: innerMsg.Lap,
              session_key: sessionKey,
              meeting_key: 0,
            });
          }
        }
      }
      continue;
    }

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

  const posData = state.Position;
  if (!posData.Position || posData.Position.length === 0) return [];

  // Use the latest position entry
  const latest = posData.Position[posData.Position.length - 1];
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
