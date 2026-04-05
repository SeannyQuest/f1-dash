"use client";

import { useMemo } from "react";
import { useSimulation } from "@/contexts/SimulationContext";

/**
 * Overlay shown when the simulation has produced a ready timeline.
 * Dual final-order column + per-driver delta summary.
 */
export function SimulationComparison() {
  const sim = useSimulation();

  const rows = useMemo(() => {
    if (!sim?.state.timeline || !sim?.state.actualTimeline) return [];
    const sim_ = sim.state.timeline;
    const actual = sim.state.actualTimeline;
    const driverLookup = new Map(
      sim_.driverList.map((d) => [d.driver_number, d]),
    );

    // Latest position per driver in each timeline.
    function finalPositions(
      laps: typeof sim_.laps,
    ): Map<number, { position: number; gap: number }> {
      const m = new Map<number, { position: number; gap: number }>();
      const sorted = [...laps].sort((a, b) => b.lapNumber - a.lapNumber);
      for (const l of sorted) {
        if (!m.has(l.driverNumber) && !l.retired) {
          m.set(l.driverNumber, { position: l.position, gap: l.gapToLeader });
        }
      }
      return m;
    }

    const actualFinal = finalPositions(actual.laps);
    const simFinal = finalPositions(sim_.laps);

    const entries = Array.from(driverLookup.values()).map((d) => {
      const a = actualFinal.get(d.driver_number);
      const s = simFinal.get(d.driver_number);
      return {
        driverNumber: d.driver_number,
        tla: d.name_acronym,
        teamColour: d.team_colour,
        actualPos: a?.position ?? 0,
        simPos: s?.position ?? 0,
        delta: (a?.position ?? 0) - (s?.position ?? 0),
      };
    });

    // Sort by simulated position for the right column display
    return entries.sort((a, b) => a.simPos - b.simPos);
  }, [sim?.state.timeline, sim?.state.actualTimeline]);

  if (!sim || sim.state.status !== "ready" || !sim.state.timeline) return null;

  const scenarioSummary = sim.state.scenarios.map(describeScenario).join(" · ");

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 max-h-[60vh] overflow-auto border-t border-purple-500/30 bg-[#0a0a0a]/95 backdrop-blur-md p-4 shadow-[0_-8px_32px_rgba(168,85,247,0.15)]">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold text-purple-300 uppercase tracking-wider">
            Simulation · fork lap {sim.state.forkLap}
          </div>
          <div className="text-[10px] text-white/40 mt-0.5 font-mono">
            {scenarioSummary}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => sim.reset()}
            className="px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider text-white/60 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_1fr] gap-4">
        <div>
          <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">
            Actual
          </div>
          <div className="flex flex-col gap-1">
            {rows
              .slice()
              .sort((a, b) => a.actualPos - b.actualPos)
              .map((r) => (
                <Row key={r.driverNumber} {...r} showDelta={false} />
              ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-purple-300 uppercase tracking-wider mb-2">
            Simulated
          </div>
          <div className="flex flex-col gap-1">
            {rows.map((r) => (
              <Row key={r.driverNumber} {...r} showDelta={true} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface RowProps {
  driverNumber: number;
  tla: string;
  teamColour: string;
  actualPos: number;
  simPos: number;
  delta: number;
  showDelta: boolean;
}

function Row({ tla, teamColour, actualPos, simPos, delta, showDelta }: RowProps) {
  const pos = showDelta ? simPos : actualPos;
  return (
    <div className="flex items-center gap-2 bg-white/[0.02] border border-white/[0.04] rounded px-2 py-1 text-[10px]">
      <span className="font-mono text-white/60 w-5 tabular-nums text-right">
        {pos}
      </span>
      <span
        className="w-1 h-4 rounded-sm"
        style={{ background: `#${teamColour}` }}
      />
      <span className="font-bold text-white/90 w-8">{tla}</span>
      {showDelta && delta !== 0 && (
        <span
          className="ml-auto font-mono text-[9px] tabular-nums"
          style={{
            color: delta > 0 ? "#00d25a" : "#ff4444",
          }}
        >
          {delta > 0 ? `+${delta}` : delta}
        </span>
      )}
    </div>
  );
}

function describeScenario(s: import("@/types/simulation").Scenario): string {
  switch (s.type) {
    case "ALT_PIT_WINDOW":
      return `#${s.driverNumber} pit lap ${s.newPitLap}${s.newCompound ? ` → ${s.newCompound}` : ""}`;
    case "ALT_COMPOUND":
      return `#${s.driverNumber} use ${s.compound}`;
    case "SAFETY_CAR":
      return `SC lap ${s.atLap} for ${s.durationLaps}`;
    case "DNF":
      return `#${s.driverNumber} DNF lap ${s.atLap}`;
  }
}
