"use client";

import { useMemo } from "react";
import { useLiveTiming } from "@/contexts/LiveTimingContext";
import { POLL_INTERVALS } from "@/lib/constants";

export function useLiveMode(sessionKey: string | null) {
  const liveTiming = useLiveTiming();

  // We're live if the SignalR relay is connected and has data
  const isLive = liveTiming.connected && liveTiming.drivers !== null;

  const intervals = useMemo(
    () => ({
      positions: isLive ? POLL_INTERVALS.positions : (false as const),
      laps: isLive ? POLL_INTERVALS.laps : (false as const),
      intervals: isLive ? POLL_INTERVALS.intervals : (false as const),
      weather: isLive ? POLL_INTERVALS.weather : (false as const),
      raceControl: isLive ? POLL_INTERVALS.raceControl : (false as const),
      carData: isLive ? POLL_INTERVALS.carData : (false as const),
      stints: isLive ? POLL_INTERVALS.stints : (false as const),
      drivers: isLive ? POLL_INTERVALS.drivers : (false as const),
    }),
    [isLive],
  );

  return { isLive, intervals };
}
