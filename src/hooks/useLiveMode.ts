"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { POLL_INTERVALS } from "@/lib/constants";
import type { Session } from "@/types";

export function useLiveMode(sessionKey: string | null) {
  const { data: sessions } = useQuery<Session[]>({
    queryKey: ["f1", "session-detail", sessionKey],
    queryFn: async () => {
      if (!sessionKey) return [];
      const res = await fetch(`/api/f1/sessions?meeting_key=0&session_key_override=${sessionKey}`);
      return res.json();
    },
    enabled: false, // We'll determine live status from session data passed in
  });

  // For now, determine live status based on whether the session end date is in the future
  // This will be enhanced when we have the session detail available
  const isLive = useMemo(() => {
    if (!sessions || sessions.length === 0) return false;
    const session = sessions[0];
    return new Date(session.date_end) > new Date();
  }, [sessions]);

  const intervals = useMemo(
    () => ({
      positions: isLive ? POLL_INTERVALS.positions : false as const,
      laps: isLive ? POLL_INTERVALS.laps : false as const,
      intervals: isLive ? POLL_INTERVALS.intervals : false as const,
      weather: isLive ? POLL_INTERVALS.weather : false as const,
      raceControl: isLive ? POLL_INTERVALS.raceControl : false as const,
      carData: isLive ? POLL_INTERVALS.carData : false as const,
      stints: isLive ? POLL_INTERVALS.stints : false as const,
      drivers: isLive ? POLL_INTERVALS.drivers : false as const,
    }),
    [isLive]
  );

  return { isLive, intervals };
}
