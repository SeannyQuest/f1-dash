"use client";

import { WeatherStrip } from "@/components/shared/WeatherStrip";
import { StatusDot } from "@/components/shared/StatusDot";
import { useLiveTiming } from "@/contexts/LiveTimingContext";

interface HeaderProps {
  sessionKey: string | null;
  isLive: boolean;
  weatherRefetchInterval: number | false;
  sessionLabel?: string;
}

export function Header({
  sessionKey,
  isLive,
  weatherRefetchInterval,
  sessionLabel,
}: HeaderProps) {
  const liveTiming = useLiveTiming();

  const clock = liveTiming.sessionClock;
  const lapCount = liveTiming.lapCount;

  return (
    <header
      className="relative flex items-center justify-between h-12 px-4 shrink-0 overflow-hidden"
      style={{
        background:
          "linear-gradient(90deg, rgb(20, 10, 10) 0%, rgb(14, 16, 26) 30%, rgb(14, 16, 26) 70%, rgb(14, 16, 26) 100%)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
      }}
    >
      {/* Red accent stripe at bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[2px]"
        style={{
          background:
            "linear-gradient(90deg, #E10600 0%, rgba(225, 6, 0, 0.4) 30%, transparent 60%)",
        }}
      />

      {/* Logo + session info */}
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-bold tracking-tight whitespace-nowrap">
          <span className="text-white">F1</span>{" "}
          <span
            className="text-transparent bg-clip-text"
            style={{
              backgroundImage:
                "linear-gradient(135deg, #FF1801 0%, #E10600 50%, #CC0500 100%)",
            }}
          >
            DASH
          </span>
        </h1>
        {sessionLabel && (
          <>
            <span className="text-white/10">|</span>
            <span className="text-[11px] text-white/50 font-semibold uppercase tracking-wide">
              {sessionLabel}
            </span>
          </>
        )}
        {/* Session clock / lap counter */}
        {isLive && (clock || lapCount) && (
          <>
            <span className="text-white/10">|</span>
            <div className="flex items-center gap-2">
              {clock && (
                <span className="font-mono text-sm font-bold text-white/90 tabular-nums">
                  {clock}
                </span>
              )}
              {lapCount && lapCount.total > 0 && (
                <span className="font-mono text-xs text-white/50">
                  Lap {lapCount.current}/{lapCount.total}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Right: weather + live status */}
      <div className="flex items-center gap-4">
        <WeatherStrip
          sessionKey={sessionKey}
          refetchInterval={weatherRefetchInterval}
        />
        {sessionKey && (
          <>
            <div className="w-px h-4 bg-white/10" />
            <StatusDot isLive={isLive} />
          </>
        )}
      </div>
    </header>
  );
}
