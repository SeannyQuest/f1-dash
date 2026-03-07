"use client";

/**
 * Unified F1 data hooks.
 * When live timing is connected and has data, use SignalR relay.
 * Otherwise fall back to OpenF1 REST API via React Query.
 */

import { useLiveTiming } from "@/contexts/LiveTimingContext";
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

function useLiveOrRest<T>(
  liveData: T | null,
  restResult: { data: T | undefined },
): { data: T | undefined } {
  const live = useLiveTiming();
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
  const rest = useDriversRest(
    live.connected && live.drivers ? null : sessionKey,
    refetchInterval,
  );
  return useLiveOrRest(live.drivers, rest);
}

export function usePositions(
  sessionKey: string | null,
  refetchInterval?: number | false,
): { data: Position[] | undefined } {
  const live = useLiveTiming();
  const rest = usePositionsRest(
    live.connected && live.positions ? null : sessionKey,
    refetchInterval,
  );
  return useLiveOrRest(live.positions, rest);
}

export function useLaps(
  sessionKey: string | null,
  driverNumber?: string,
  refetchInterval?: number | false,
): { data: Lap[] | undefined } {
  const live = useLiveTiming();
  const rest = useLapsRest(
    live.connected && live.laps ? null : sessionKey,
    driverNumber,
    refetchInterval,
  );
  return useLiveOrRest(live.laps, rest);
}

export function useIntervals(
  sessionKey: string | null,
  refetchInterval?: number | false,
): { data: Interval[] | undefined } {
  const live = useLiveTiming();
  const rest = useIntervalsRest(
    live.connected && live.intervals ? null : sessionKey,
    refetchInterval,
  );
  return useLiveOrRest(live.intervals, rest);
}

export function useStints(
  sessionKey: string | null,
  refetchInterval?: number | false,
): { data: Stint[] | undefined } {
  const live = useLiveTiming();
  const rest = useStintsRest(
    live.connected && live.stints ? null : sessionKey,
    refetchInterval,
  );
  return useLiveOrRest(live.stints, rest);
}

export function useWeather(
  sessionKey: string | null,
  refetchInterval?: number | false,
): { data: Weather[] | undefined } {
  const live = useLiveTiming();
  const rest = useWeatherRest(
    live.connected && live.weather ? null : sessionKey,
    refetchInterval,
  );
  return useLiveOrRest(live.weather, rest);
}

export function useRaceControl(
  sessionKey: string | null,
  refetchInterval?: number | false,
): { data: RaceControlMessage[] | undefined } {
  const live = useLiveTiming();
  const rest = useRaceControlRest(
    live.connected && live.raceControl ? null : sessionKey,
    refetchInterval,
  );
  return useLiveOrRest(live.raceControl, rest);
}
