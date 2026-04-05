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
  useTeamRadio as useTeamRadioRest,
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
 * Team radio captures.
 *
 * Priority:
 *   1. Replay SignalR state (if replay includes TeamRadio — F1's CDN 403s
 *      the jsonStream so this path rarely fires)
 *   2. Live SignalR state
 *   3. OpenF1 REST fallback (the only reliable source for archived sessions)
 *
 * The returned `audioUrl` is always absolute and publicly accessible.
 */
export function useTeamRadio(sessionKey: string | null): {
  data: TeamRadioCapture[] | undefined;
} {
  const live = useLiveTiming();
  const replay = useReplay();
  const replayActive = replay != null && replay.status !== "idle";

  // REST session key: prefer the replay session when active, else the
  // user-selected session. Gate the query so we don't double-fetch when live
  // SignalR already has data.
  const restSessionKey = replayActive
    ? replay.sessionInfo?.sessionKey != null
      ? String(replay.sessionInfo.sessionKey)
      : null
    : live.connected && live.teamRadio && live.teamRadio.length > 0
      ? null
      : sessionKey;

  const rest = useTeamRadioRest(restSessionKey);

  if (replayActive && replay.teamRadio && replay.teamRadio.length > 0) {
    return { data: replay.teamRadio };
  }
  if (live.connected && live.teamRadio && live.teamRadio.length > 0) {
    return { data: live.teamRadio };
  }
  // REST fallback — map OpenF1 shape to our TeamRadioCapture type.
  if (rest.data) {
    const mapped: TeamRadioCapture[] = rest.data
      .map((r) => ({
        driver_number: r.driver_number,
        date: r.date,
        audioUrl: r.recording_url,
      }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    return { data: mapped };
  }
  return { data: undefined };
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
