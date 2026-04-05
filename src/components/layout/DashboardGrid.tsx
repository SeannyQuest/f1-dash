"use client";

import { Suspense, useState } from "react";
import { useSessionState } from "@/hooks/useSessionState";
import { useLiveTiming } from "@/contexts/LiveTimingContext";
import { LiveTimingProvider } from "@/contexts/LiveTimingContext";
import { ReplayProvider, useReplay } from "@/contexts/ReplayContext";
import { SimulationProvider } from "@/contexts/SimulationContext";
import { Header } from "@/components/layout/Header";
import { SessionBar } from "@/components/layout/SessionBar";
import { ReplayBar } from "@/components/layout/ReplayBar";
import { TimingTower } from "@/components/panels/TimingTower";
import { TrackMap } from "@/components/panels/TrackMap";
import { TireStrategy } from "@/components/panels/TireStrategy";
import { LapTimeChart } from "@/components/panels/LapTimeChart";
import { RaceControlFeed } from "@/components/panels/RaceControlFeed";
import { DriverComparison } from "@/components/panels/DriverComparison";
import { TelemetryPanel } from "@/components/panels/TelemetryPanel";
import { RadioFeed } from "@/components/panels/RadioFeed";
import { ForkButton } from "@/components/simulation/ForkButton";
import { ScenarioPickerModal } from "@/components/simulation/ScenarioPickerModal";
import { SimulationComparison } from "@/components/simulation/SimulationComparison";

function DashboardInner() {
  const { sessionKey, circuitKey, year, setSession } = useSessionState();
  const liveTiming = useLiveTiming();
  const replay = useReplay();
  const [showCompare, setShowCompare] = useState(false);
  const [showScenarioModal, setShowScenarioModal] = useState(false);

  // Live if the relay is connected and has driver data
  const isLive = liveTiming.connected && liveTiming.drivers !== null;
  // Replay mode is active if replay has loaded data
  const isReplay = replay != null && replay.status !== "idle";

  // Build session label from live info, replay info, or URL params
  const sessionLabel =
    isReplay && replay.sessionInfo
      ? `${replay.sessionInfo.meetingName} · ${replay.sessionInfo.sessionName}`
      : isLive && liveTiming.liveSessionInfo.meetingName
        ? `${liveTiming.liveSessionInfo.meetingName}${liveTiming.liveSessionInfo.sessionName ? ` · ${liveTiming.liveSessionInfo.sessionName}` : ""}`
        : undefined;

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header
        sessionKey={sessionKey}
        isLive={isLive || isReplay}
        weatherRefetchInterval={false}
        sessionLabel={sessionLabel}
      />

      <SessionBar
        onSessionSelect={setSession}
        hasActiveSession={!!sessionKey}
      />

      <ReplayBar />

      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[340px_1fr_360px] gap-[2px] p-[2px] overflow-hidden">
        <div className="overflow-hidden xl:flex xl:flex-col min-h-0">
          <TimingTower
            sessionKey={sessionKey}
            isLive={isLive}
            refetchInterval={false}
          />
        </div>

        <div className="grid grid-rows-[1fr_auto_auto] gap-[2px] overflow-hidden min-h-0">
          <div className="overflow-hidden min-h-0">
            <TrackMap
              sessionKey={sessionKey}
              circuitKey={circuitKey}
              year={year}
              isLive={isLive}
              refetchInterval={false}
            />
          </div>
          <div className="overflow-hidden max-h-[220px]">
            <TireStrategy
              sessionKey={sessionKey}
              isLive={isLive}
              refetchInterval={false}
            />
          </div>
          <div className="overflow-hidden max-h-[200px]">
            <RadioFeed
              sessionKey={sessionKey}
              isLive={isLive}
              refetchInterval={false}
            />
          </div>
        </div>

        <div className="grid grid-rows-[1fr_1fr_1fr] gap-[2px] overflow-hidden min-h-0">
          <div className="overflow-hidden min-h-0">
            <LapTimeChart
              sessionKey={sessionKey}
              isLive={isLive}
              refetchInterval={false}
            />
          </div>
          <div className="overflow-hidden min-h-0">
            <TelemetryPanel
              sessionKey={sessionKey}
              isLive={isLive}
              refetchInterval={false}
            />
          </div>
          <div className="overflow-hidden min-h-0">
            <RaceControlFeed
              sessionKey={sessionKey}
              isLive={isLive}
              refetchInterval={false}
            />
          </div>
        </div>
      </div>

      {showCompare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg animate-[fade-in_0.2s_ease-out]">
            <DriverComparison
              sessionKey={sessionKey}
              isLive={isLive}
              refetchInterval={false}
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

      {sessionKey && !showCompare && (
        <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2">
          <ForkButton onOpenModal={() => setShowScenarioModal(true)} />
          <button
            onClick={() => setShowCompare(true)}
            className="px-4 py-2.5 rounded text-[10px] font-black uppercase tracking-wider text-white/80 transition-all duration-200 hover:scale-105"
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
        </div>
      )}

      <ScenarioPickerModal
        open={showScenarioModal}
        onClose={() => setShowScenarioModal(false)}
      />
      <SimulationComparison />
    </div>
  );
}

function DashboardContent() {
  const { sessionKey } = useSessionState();

  return (
    <LiveTimingProvider enabled={true} sessionKey={sessionKey}>
      <ReplayProvider>
        <SimulationProvider>
          <DashboardInner />
        </SimulationProvider>
      </ReplayProvider>
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
