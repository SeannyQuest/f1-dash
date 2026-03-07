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
} from "@/types";

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
