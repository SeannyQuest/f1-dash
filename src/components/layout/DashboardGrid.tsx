"use client";

import { Suspense } from "react";
import { useSessionState } from "@/hooks/useSessionState";
import { useLiveMode } from "@/hooks/useLiveMode";
import { usePanelLayout } from "@/hooks/usePanelLayout";
import { SessionSelector } from "@/components/panels/SessionSelector";
import { TimingTower } from "@/components/panels/TimingTower";
import { TrackMap } from "@/components/panels/TrackMap";
import { TireStrategy } from "@/components/panels/TireStrategy";
import { LapTimeChart } from "@/components/panels/LapTimeChart";
import { WeatherWidget } from "@/components/panels/WeatherWidget";
import { RaceControlFeed } from "@/components/panels/RaceControlFeed";
import { DriverComparison } from "@/components/panels/DriverComparison";
import type { PanelId } from "@/types";

const PANEL_TOGGLE_LABELS: Record<PanelId, string> = {
  "session-selector": "Session",
  "timing-tower": "Timing",
  "track-map": "Track",
  "tire-strategy": "Tires",
  "lap-chart": "Laps",
  weather: "Weather",
  "race-control": "Race Ctrl",
  "driver-comparison": "Compare",
};

function DashboardContent() {
  const { sessionKey, circuitKey, year, setSession } = useSessionState();
  const { isLive, intervals } = useLiveMode(sessionKey);
  const { isVisible, togglePanel } = usePanelLayout();

  return (
    <div className="space-y-4">
      {/* Panel toggles */}
      <div className="flex flex-wrap gap-2">
        {(Object.entries(PANEL_TOGGLE_LABELS) as [PanelId, string][]).map(
          ([id, label]) => (
            <button
              key={id}
              onClick={() => togglePanel(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isVisible(id)
                  ? "bg-cyan-primary/20 text-cyan-primary border border-cyan-primary/30"
                  : "bg-white/[0.04] text-white/40 border border-white/[0.06] hover:text-white/60"
              }`}
            >
              {label}
            </button>
          ),
        )}
      </div>

      {/* Panel grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 auto-rows-min">
        {isVisible("session-selector") && (
          <div className="md:col-span-2 xl:col-span-3 2xl:col-span-4">
            <SessionSelector onSessionSelect={setSession} />
          </div>
        )}

        {isVisible("timing-tower") && (
          <div className="xl:row-span-2">
            <TimingTower
              sessionKey={sessionKey}
              isLive={isLive}
              refetchInterval={intervals.positions}
            />
          </div>
        )}

        {isVisible("track-map") && (
          <TrackMap
            sessionKey={sessionKey}
            circuitKey={circuitKey}
            year={year}
            isLive={isLive}
            refetchInterval={intervals.positions}
          />
        )}

        {isVisible("weather") && (
          <WeatherWidget
            sessionKey={sessionKey}
            isLive={isLive}
            refetchInterval={intervals.weather}
          />
        )}

        {isVisible("race-control") && (
          <RaceControlFeed
            sessionKey={sessionKey}
            isLive={isLive}
            refetchInterval={intervals.raceControl}
          />
        )}

        {isVisible("tire-strategy") && (
          <div className="md:col-span-2">
            <TireStrategy
              sessionKey={sessionKey}
              isLive={isLive}
              refetchInterval={intervals.stints}
            />
          </div>
        )}

        {isVisible("lap-chart") && (
          <div className="md:col-span-2">
            <LapTimeChart
              sessionKey={sessionKey}
              isLive={isLive}
              refetchInterval={intervals.laps}
            />
          </div>
        )}

        {isVisible("driver-comparison") && (
          <div className="md:col-span-2">
            <DriverComparison
              sessionKey={sessionKey}
              isLive={isLive}
              refetchInterval={intervals.laps}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function DashboardGrid() {
  return (
    <Suspense
      fallback={
        <div className="text-white/40 text-center py-12">
          Loading dashboard...
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
