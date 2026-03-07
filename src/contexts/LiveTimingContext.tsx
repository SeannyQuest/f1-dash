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
import {
  adaptDrivers,
  adaptPositions,
  adaptLaps,
  adaptIntervals,
  adaptStints,
  adaptWeather,
  adaptRaceControl,
  adaptTrackPositions,
  type F1LiveState,
} from "@/lib/live-timing-adapter";

const RELAY_URL =
  process.env.NEXT_PUBLIC_LIVE_RELAY_URL || "ws://localhost:8080";

interface LiveSessionInfo {
  sessionKey: string | null;
  circuitKey: string | null;
  year: string | null;
  meetingName: string | null;
  sessionName: string | null;
}

interface LiveTimingData {
  // Adapted data in component-compatible format
  drivers: Driver[] | null;
  positions: Position[] | null;
  laps: Lap[] | null;
  intervals: Interval[] | null;
  stints: Stint[] | null;
  weather: Weather[] | null;
  raceControl: RaceControlMessage[] | null;
  trackPositions: DriverLocation[];
  // Live state metadata
  lapCount: { current: number; total: number } | null;
  trackStatus: string | null;
  sessionClock: string | null;
  // Session info from relay (for auto-selecting live session)
  liveSessionInfo: LiveSessionInfo;
  // Connection info
  connected: boolean;
  relayStatus: "connected" | "disconnected" | "connecting";
  lastUpdate: number;
  // Raw state (for advanced use)
  rawState: F1LiveState | null;
}

const LiveTimingContext = createContext<LiveTimingData>({
  drivers: null,
  positions: null,
  laps: null,
  intervals: null,
  stints: null,
  weather: null,
  raceControl: null,
  trackPositions: [],
  lapCount: null,
  trackStatus: null,
  sessionClock: null,
  liveSessionInfo: {
    sessionKey: null,
    circuitKey: null,
    year: null,
    meetingName: null,
    sessionName: null,
  },
  connected: false,
  relayStatus: "disconnected",
  lastUpdate: 0,
  rawState: null,
});

export function useLiveTiming() {
  return useContext(LiveTimingContext);
}

interface LiveTimingProviderProps {
  children: ReactNode;
  enabled: boolean;
  sessionKey: string | null;
}

export function LiveTimingProvider({
  children,
  enabled,
  sessionKey,
}: LiveTimingProviderProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [rawState, setRawState] = useState<F1LiveState | null>(null);
  const [relayStatus, setRelayStatus] = useState<
    "connected" | "disconnected" | "connecting"
  >("disconnected");
  const [lastUpdate, setLastUpdate] = useState(0);

  const connect = useCallback(() => {
    if (!enabled) return;

    setRelayStatus("connecting");
    const ws = new WebSocket(RELAY_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setRelayStatus("connected");
      console.log("[LiveTiming] Connected to relay");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.type === "state" && msg.data) {
          setRawState(msg.data as F1LiveState);
          setLastUpdate(msg.ts || Date.now());
        } else if (msg.type === "status") {
          console.log(`[LiveTiming] Relay status: ${msg.status}`);
        }
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      setRelayStatus("disconnected");
      wsRef.current = null;
      if (enabled) {
        reconnectTimer.current = setTimeout(connect, 3000);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [enabled]);

  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [enabled, connect]);

  // Adapt raw state to component-compatible format
  const sessionKeyNum = sessionKey ? parseInt(sessionKey, 10) : 0;

  const adapted = useMemo<LiveTimingData>(() => {
    const noSession: LiveSessionInfo = {
      sessionKey: null,
      circuitKey: null,
      year: null,
      meetingName: null,
      sessionName: null,
    };

    if (!rawState) {
      return {
        drivers: null,
        positions: null,
        laps: null,
        intervals: null,
        stints: null,
        weather: null,
        raceControl: null,
        trackPositions: [],
        lapCount: null,
        trackStatus: null,
        sessionClock: null,
        liveSessionInfo: noSession,
        connected: relayStatus === "connected",
        relayStatus,
        lastUpdate,
        rawState: null,
      };
    }

    const lapCount = rawState.LapCount;
    const trackStatus = rawState.TrackStatus;
    const clock = rawState.ExtrapolatedClock;

    // Extract session info from SignalR's SessionInfo topic
    const si = rawState.SessionInfo ?? {};
    const meeting = si.Meeting as Record<string, unknown> | undefined;
    const circuit = meeting?.Circuit as Record<string, unknown> | undefined;
    const startDate = si.StartDate as string | undefined;
    const liveSessionInfo: LiveSessionInfo = {
      sessionKey: si.Key != null ? String(si.Key) : null,
      circuitKey: circuit?.Key != null ? String(circuit.Key) : null,
      year: startDate ? startDate.slice(0, 4) : null,
      meetingName: (meeting?.Name as string) ?? null,
      sessionName: (si.Name as string) ?? null,
    };

    return {
      drivers: adaptDrivers(rawState, sessionKeyNum),
      positions: adaptPositions(rawState, sessionKeyNum),
      laps: adaptLaps(rawState, sessionKeyNum),
      intervals: adaptIntervals(rawState, sessionKeyNum),
      stints: adaptStints(rawState, sessionKeyNum),
      weather: adaptWeather(rawState, sessionKeyNum),
      raceControl: adaptRaceControl(rawState, sessionKeyNum),
      trackPositions: adaptTrackPositions(rawState),
      lapCount:
        lapCount?.CurrentLap != null
          ? {
              current: lapCount.CurrentLap as number,
              total: (lapCount.TotalLaps as number) ?? 0,
            }
          : null,
      trackStatus: (trackStatus?.Status as string) ?? null,
      sessionClock: (clock?.Remaining as string) ?? null,
      liveSessionInfo,
      connected: relayStatus === "connected",
      relayStatus,
      lastUpdate,
      rawState,
    };
  }, [rawState, relayStatus, lastUpdate, sessionKeyNum]);

  return (
    <LiveTimingContext.Provider value={adapted}>
      {children}
    </LiveTimingContext.Provider>
  );
}
