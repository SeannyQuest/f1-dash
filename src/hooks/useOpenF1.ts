"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  Meeting,
  Session,
  Driver,
  Lap,
  Position,
  Stint,
  Weather,
  RaceControlMessage,
  Interval,
} from "@/types";

async function fetchAPI<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(path, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<T>;
}

export function useMeetings(year: string) {
  return useQuery<Meeting[]>({
    queryKey: ["f1", "meetings", year],
    queryFn: () => fetchAPI<Meeting[]>("/api/f1/meetings", { year }),
    enabled: !!year,
  });
}

export function useSessions(meetingKey: string | null) {
  return useQuery<Session[]>({
    queryKey: ["f1", "sessions", meetingKey],
    queryFn: () => fetchAPI<Session[]>("/api/f1/sessions", { meeting_key: meetingKey! }),
    enabled: !!meetingKey,
  });
}

export function useDrivers(sessionKey: string | null, refetchInterval?: number | false) {
  return useQuery<Driver[]>({
    queryKey: ["f1", "drivers", sessionKey],
    queryFn: () => fetchAPI<Driver[]>("/api/f1/drivers", { session_key: sessionKey! }),
    enabled: !!sessionKey,
    refetchInterval: refetchInterval || false,
  });
}

export function useLaps(sessionKey: string | null, driverNumber?: string, refetchInterval?: number | false) {
  const params: Record<string, string> = {};
  if (sessionKey) params.session_key = sessionKey;
  if (driverNumber) params.driver_number = driverNumber;
  return useQuery<Lap[]>({
    queryKey: ["f1", "laps", sessionKey, driverNumber ?? "all"],
    queryFn: () => fetchAPI<Lap[]>("/api/f1/laps", params),
    enabled: !!sessionKey,
    refetchInterval: refetchInterval || false,
  });
}

export function usePositions(sessionKey: string | null, refetchInterval?: number | false) {
  return useQuery<Position[]>({
    queryKey: ["f1", "positions", sessionKey],
    queryFn: () => fetchAPI<Position[]>("/api/f1/positions", { session_key: sessionKey! }),
    enabled: !!sessionKey,
    refetchInterval: refetchInterval || false,
  });
}

export function useStints(sessionKey: string | null, refetchInterval?: number | false) {
  return useQuery<Stint[]>({
    queryKey: ["f1", "stints", sessionKey],
    queryFn: () => fetchAPI<Stint[]>("/api/f1/stints", { session_key: sessionKey! }),
    enabled: !!sessionKey,
    refetchInterval: refetchInterval || false,
  });
}

export function useWeather(sessionKey: string | null, refetchInterval?: number | false) {
  return useQuery<Weather[]>({
    queryKey: ["f1", "weather", sessionKey],
    queryFn: () => fetchAPI<Weather[]>("/api/f1/weather", { session_key: sessionKey! }),
    enabled: !!sessionKey,
    refetchInterval: refetchInterval || false,
  });
}

export function useRaceControl(sessionKey: string | null, refetchInterval?: number | false) {
  return useQuery<RaceControlMessage[]>({
    queryKey: ["f1", "race-control", sessionKey],
    queryFn: () => fetchAPI<RaceControlMessage[]>("/api/f1/race-control", { session_key: sessionKey! }),
    enabled: !!sessionKey,
    refetchInterval: refetchInterval || false,
  });
}

export function useIntervals(sessionKey: string | null, refetchInterval?: number | false) {
  return useQuery<Interval[]>({
    queryKey: ["f1", "intervals", sessionKey],
    queryFn: () => fetchAPI<Interval[]>("/api/f1/intervals", { session_key: sessionKey! }),
    enabled: !!sessionKey,
    refetchInterval: refetchInterval || false,
  });
}
