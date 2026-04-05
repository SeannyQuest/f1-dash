"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import {
  ReplayEngine,
  type ReplayState,
  type ReplaySessionInfo,
} from "@/lib/replay-engine";
import type {
  Driver,
  Lap,
  Position,
  Interval,
  Stint,
  Weather,
  RaceControlMessage,
  CarData,
} from "@/types";
import type { DriverLocation } from "@/hooks/useWebSocket";
import {
  adaptDrivers,
  adaptPositions,
  adaptLaps,
  adaptIntervals,
  adaptStints,
  adaptWeather,
  adaptRaceControl,
  adaptTrackPositions,
  adaptCarData,
  adaptPitStops,
  adaptSessionStatus,
  adaptTeamRadio,
  type PitStop,
  type TeamRadioCapture,
} from "@/lib/live-timing-adapter";

// ── Context shape ──

interface ReplayContextData {
  // Replay state
  status: ReplayState["status"];
  error?: string;
  duration: number;
  currentTime: number;
  speed: number;
  sessionInfo: ReplaySessionInfo | null;

  // Adapted F1 data (same shape as LiveTimingContext)
  drivers: Driver[] | null;
  positions: Position[] | null;
  laps: Lap[] | null;
  intervals: Interval[] | null;
  stints: Stint[] | null;
  weather: Weather[] | null;
  raceControl: RaceControlMessage[] | null;
  carData: CarData[] | null;
  pitStops: PitStop[] | null;
  teamRadio: TeamRadioCapture[] | null;
  trackPositions: DriverLocation[];
  lapCount: { current: number; total: number } | null;
  trackStatus: string | null;
  sessionStatus: string | null;
  sessionClock: string | null;

  // Controls
  load: (session: ReplaySessionInfo) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  setSpeed: (speed: number) => void;
}

const ReplayContext = createContext<ReplayContextData | null>(null);

export function useReplay(): ReplayContextData | null {
  return useContext(ReplayContext);
}

export function ReplayProvider({ children }: { children: ReactNode }) {
  const engineRef = useRef<ReplayEngine | null>(null);
  const [replayState, setReplayState] = useState<ReplayState>({
    status: "idle",
    duration: 0,
    currentTime: 0,
    speed: 1,
    f1State: null,
    sessionInfo: null,
  });

  // Create engine once
  useEffect(() => {
    const engine = new ReplayEngine();
    engineRef.current = engine;

    const unsubscribe = engine.subscribe((state) => {
      setReplayState(state);
    });

    return () => {
      unsubscribe();
      engine.destroy();
    };
  }, []);

  const load = useCallback((session: ReplaySessionInfo) => {
    engineRef.current?.load(session);
  }, []);

  const play = useCallback(() => {
    engineRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    engineRef.current?.pause();
  }, []);

  const stop = useCallback(() => {
    engineRef.current?.stop();
  }, []);

  const seek = useCallback((time: number) => {
    engineRef.current?.seek(time);
  }, []);

  const setSpeed = useCallback((speed: number) => {
    engineRef.current?.setSpeed(speed);
  }, []);

  // Adapt F1 state through the same pipeline as live data
  const adapted = useMemo(() => {
    const f1 = replayState.f1State;
    const sessionKeyNum = replayState.sessionInfo?.sessionKey ?? 0;

    if (!f1) {
      return {
        drivers: null,
        positions: null,
        laps: null,
        intervals: null,
        stints: null,
        weather: null,
        raceControl: null,
        carData: null,
        pitStops: null,
        teamRadio: null,
        trackPositions: [] as DriverLocation[],
        lapCount: null,
        trackStatus: null,
        sessionStatus: null,
        sessionClock: null,
      };
    }

    const lapCount = f1.LapCount;
    const trackStatus = f1.TrackStatus;
    const clock = f1.ExtrapolatedClock;

    return {
      drivers: adaptDrivers(f1, sessionKeyNum),
      positions: adaptPositions(f1, sessionKeyNum),
      laps: adaptLaps(f1, sessionKeyNum),
      intervals: adaptIntervals(f1, sessionKeyNum),
      stints: adaptStints(f1, sessionKeyNum),
      weather: adaptWeather(f1, sessionKeyNum),
      raceControl: adaptRaceControl(f1, sessionKeyNum),
      carData: adaptCarData(f1, sessionKeyNum),
      pitStops: adaptPitStops(f1),
      teamRadio: adaptTeamRadio(f1),
      trackPositions: adaptTrackPositions(f1),
      lapCount:
        lapCount?.CurrentLap != null
          ? {
              current: lapCount.CurrentLap as number,
              total: (lapCount.TotalLaps as number) ?? 0,
            }
          : null,
      trackStatus: (trackStatus?.Status as string) ?? null,
      sessionStatus: adaptSessionStatus(f1),
      sessionClock: (clock?.Remaining as string) ?? null,
    };
  }, [replayState.f1State, replayState.sessionInfo]);

  const value: ReplayContextData = {
    status: replayState.status,
    error: replayState.error,
    duration: replayState.duration,
    currentTime: replayState.currentTime,
    speed: replayState.speed,
    sessionInfo: replayState.sessionInfo,
    ...adapted,
    load,
    play,
    pause,
    stop,
    seek,
    setSpeed,
  };

  return (
    <ReplayContext.Provider value={value}>{children}</ReplayContext.Provider>
  );
}
