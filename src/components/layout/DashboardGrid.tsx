"use client";

import { Suspense, useState } from "react";
import { useSessionState } from "@/hooks/useSessionState";
import { useLiveMode } from "@/hooks/useLiveMode";
import { LiveTimingProvider } from "@/contexts/LiveTimingContext";
import { Header } from "@/components/layout/Header";
import { SessionBar } from "@/components/layout/SessionBar";
import { TimingTower } from "@/components/panels/TimingTower";
import { TrackMap } from "@/components/panels/TrackMap";
import { TireStrategy } from "@/components/panels/TireStrategy";
import { LapTimeChart } from "@/components/panels/LapTimeChart";
import { RaceControlFeed } from "@/components/panels/RaceControlFeed";
import { DriverComparison } from "@/components/panels/DriverComparison";

function DashboardContent() {
  const { sessionKey, circuitKey, year, setSession } = useSessionState();
  const { isLive, intervals } = useLiveMode(sessionKey);
  const [showCompare, setShowCompare] = useState(false);

  return (
    <LiveTimingProvider enabled={isLive} sessionKey={sessionKey}>
      <div className="h-screen flex flex-col overflow-hidden">
        {/* Header with weather strip */}
        <Header
          sessionKey={sessionKey}
          isLive={isLive}
          weatherRefetchInterval={intervals.weather}
        />

        {/* Collapsible session bar */}
        <SessionBar
          onSessionSelect={setSession}
          hasActiveSession={!!sessionKey}
        />

        {/* Main broadcast layout */}
        <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[340px_1fr_360px] gap-[2px] p-[2px] overflow-hidden">
          {/* Left column: Timing Tower (full height) */}
          <div className="overflow-hidden xl:flex xl:flex-col min-h-0">
            <TimingTower
              sessionKey={sessionKey}
              isLive={isLive}
              refetchInterval={intervals.positions}
            />
          </div>

          {/* Center column: Track Map (top) + Tire Strategy (bottom) */}
          <div className="grid grid-rows-[1fr_auto] gap-[2px] overflow-hidden min-h-0">
            <div className="overflow-hidden min-h-0">
              <TrackMap
                sessionKey={sessionKey}
                circuitKey={circuitKey}
                year={year}
                isLive={isLive}
                refetchInterval={intervals.positions}
              />
            </div>
            <div className="overflow-hidden max-h-[280px]">
              <TireStrategy
                sessionKey={sessionKey}
                isLive={isLive}
                refetchInterval={intervals.stints}
              />
            </div>
          </div>

          {/* Right column: Lap Chart (top) + Race Control (bottom) */}
          <div className="grid grid-rows-[1fr_1fr] gap-[2px] overflow-hidden min-h-0">
            <div className="overflow-hidden min-h-0">
              <LapTimeChart
                sessionKey={sessionKey}
                isLive={isLive}
                refetchInterval={intervals.laps}
              />
            </div>
            <div className="overflow-hidden min-h-0">
              <RaceControlFeed
                sessionKey={sessionKey}
                isLive={isLive}
                refetchInterval={intervals.raceControl}
              />
            </div>
          </div>
        </div>

        {/* Driver Comparison overlay */}
        {showCompare && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-lg animate-[fade-in_0.2s_ease-out]">
              <DriverComparison
                sessionKey={sessionKey}
                isLive={isLive}
                refetchInterval={intervals.laps}
              />
              <button
                onClick={() => setShowCompare(false)}
                className="mt-2 w-full py-2 text-xs text-white/40 hover:text-white/60 transition-colors"
              >
                Close comparison
              </button>
            </div>
          </div>
        )}

        {/* Floating compare button */}
        {sessionKey && !showCompare && (
          <button
            onClick={() => setShowCompare(true)}
            className="fixed bottom-4 right-4 z-40 px-4 py-2.5 rounded text-[10px] font-black uppercase tracking-wider text-white/80 transition-all duration-200 hover:scale-105"
            style={{
              background:
                "linear-gradient(135deg, rgba(225, 6, 0, 0.25) 0%, rgba(225, 6, 0, 0.1) 100%)",
              border: "1px solid rgba(225, 6, 0, 0.4)",
              boxShadow:
                "0 2px 12px rgba(225, 6, 0, 0.2), 0 0 20px rgba(225, 6, 0, 0.05)",
            }}
          >
            Compare
          </button>
        )}
      </div>
    </LiveTimingProvider>
  );
}

export function DashboardGrid() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center text-white/30 text-sm">
          Loading dashboard...
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
