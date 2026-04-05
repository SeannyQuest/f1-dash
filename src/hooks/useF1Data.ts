"use client";

/**
 * Unified F1 data hooks.
 * Priority: Replay (if active) → Live SignalR → OpenF1 REST API.
 */

import { useLiveTiming } from "@/contexts/LiveTimingContext";
import { useReplay } from "@/contexts/ReplayContext";
import {
  useDrivers as useDriversRest,
  usePositions as usePositionsRest,
  useLaps as useLapsRest,
  useIntervals as useIntervalsRest,
  useStints as useStintsRest,
  useWeather as useWeatherRest,
  useRaceControl as useRaceControlRest,
  useMeetings,
  useSessions,
} from "@/hooks/useOpenF1";
import type {
  Driver,
  Position,
  Lap,
  Interval,
  Stint,
  Weather,
  RaceControlMessage,
  CarData,
} from "@/types";
import type { TeamRadioCapture } from "@/lib/live-timing-adapter";

// Re-export unchanged hooks
export { useMeetings, useSessions };

function useReplayOrLiveOrRest<T>(
  replayData: T | null | undefined,
  replayActive: boolean,
  liveData: T | null,
  restResult: { data: T | undefined },
): { data: T | undefined } {
  const live = useLiveTiming();
  if (replayActive && replayData != null) {
    return { data: replayData as T };
  }
  if (live.connected && liveData !== null) {
    return { data: liveData };
  }
  return restResult;
}

export function useDrivers(
  sessionKey: string | null,
  refetchInterval?: number | false,
): { data: Driver[] | undefined } {
  const live = useLiveTiming();
  const replay = useReplay();
  const replayActive = replay != null && replay.status !== "idle";
  const rest = useDriversRest(
    replayActive || (live.connected && live.drivers) ? null : sessionKey,
    refetchInterval,
  );
  return useReplayOrLiveOrRest(
    replay?.drivers,
    replayActive,
    live.drivers,
    rest,
  );
}

export function usePositions(
  sessionKey: string | null,
  refetchInterval?: number | false,
): { data: Position[] | undefined } {
  const live = useLiveTiming();
  const replay = useReplay();
  const replayActive = replay != null && replay.status !== "idle";
  const rest = usePositionsRest(
    replayActive || (live.connected && live.positions) ? null : sessionKey,
    refetchInterval,
  );
  return useReplayOrLiveOrRest(
    replay?.positions,
    replayActive,
    live.positions,
    rest,
  );
}

export function useLaps(
  sessionKey: string | null,
  driverNumber?: string,
  refetchInterval?: number | false,
): { data: Lap[] | undefined } {
  const live = useLiveTiming();
  const replay = useReplay();
  const replayActive = replay != null && replay.status !== "idle";
  const rest = useLapsRest(
    replayActive || (live.connected && live.laps) ? null : sessionKey,
    driverNumber,
    refetchInterval,
  );
  return useReplayOrLiveOrRest(replay?.laps, replayActive, live.laps, rest);
}

export function useIntervals(
  sessionKey: string | null,
  refetchInterval?: number | false,
): { data: Interval[] | undefined } {
  const live = useLiveTiming();
  const replay = useReplay();
  const replayActive = replay != null && replay.status !== "idle";
  const rest = useIntervalsRest(
    replayActive || (live.connected && live.intervals) ? null : sessionKey,
    refetchInterval,
  );
  return useReplayOrLiveOrRest(
    replay?.intervals,
    replayActive,
    live.intervals,
    rest,
  );
}

export function useStints(
  sessionKey: string | null,
  refetchInterval?: number | false,
): { data: Stint[] | undefined } {
  const live = useLiveTiming();
  const replay = useReplay();
  const replayActive = replay != null && replay.status !== "idle";
  const rest = useStintsRest(
    replayActive || (live.connected && live.stints) ? null : sessionKey,
    refetchInterval,
  );
  return useReplayOrLiveOrRest(replay?.stints, replayActive, live.stints, rest);
}

export function useWeather(
  sessionKey: string | null,
  refetchInterval?: number | false,
): { data: Weather[] | undefined } {
  const live = useLiveTiming();
  const replay = useReplay();
  const replayActive = replay != null && replay.status !== "idle";
  const rest = useWeatherRest(
    replayActive || (live.connected && live.weather) ? null : sessionKey,
    refetchInterval,
  );
  return useReplayOrLiveOrRest(
    replay?.weather,
    replayActive,
    live.weather,
    rest,
  );
}

/**
 * Live CarData telemetry (throttle, brake, DRS, gear, RPM, speed).
 * Only available from live SignalR or replay — no REST fallback, since
 * OpenF1's car_data endpoint is prohibitively large for live UI use.
 */
export function useCarData(): { data: CarData[] | undefined } {
  const live = useLiveTiming();
  const replay = useReplay();
  const replayActive = replay != null && replay.status !== "idle";
  if (replayActive && replay.carData != null) {
    return { data: replay.carData };
  }
  if (live.connected && live.carData !== null) {
    return { data: live.carData };
  }
  return { data: undefined };
}

/**
 * Team radio captures (Utc, driver, mp3 path).
 * SignalR only — no REST/OpenF1 equivalent.
 */
export function useTeamRadio(): {
  data: TeamRadioCapture[] | undefined;
  basePath: string | null;
} {
  const live = useLiveTiming();
  const replay = useReplay();
  const replayActive = replay != null && replay.status !== "idle";
  if (replayActive && replay.teamRadio != null) {
    return {
      data: replay.teamRadio,
      basePath: replay.sessionInfo?.path ?? null,
    };
  }
  if (live.connected && live.teamRadio !== null) {
    // For live, we don't have a CDN path — construct a session-relative path
    // from live session info if available. The relay's SessionInfo.Path field
    // is the same shape F1 uses in its static archive.
    const sessionPath =
      (live.rawState?.SessionInfo as { Path?: string } | undefined)?.Path ??
      null;
    return { data: live.teamRadio, basePath: sessionPath };
  }
  return { data: undefined, basePath: null };
}

export function useRaceControl(
  sessionKey: string | null,
  refetchInterval?: number | false,
): { data: RaceControlMessage[] | undefined } {
  const live = useLiveTiming();
  const replay = useReplay();
  const replayActive = replay != null && replay.status !== "idle";
  const rest = useRaceControlRest(
    replayActive || (live.connected && live.raceControl) ? null : sessionKey,
    refetchInterval,
  );
  return useReplayOrLiveOrRest(
    replay?.raceControl,
    replayActive,
    live.raceControl,
    rest,
  );
}
