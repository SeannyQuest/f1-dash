"use client";

import { useSimulation } from "@/contexts/SimulationContext";
import { useReplay } from "@/contexts/ReplayContext";
import { useLiveTiming } from "@/contexts/LiveTimingContext";

interface ForkButtonProps {
  onOpenModal: () => void;
}

/**
 * "Fork" button — snapshots current race state into the simulation engine
 * and opens the scenario picker modal.
 *
 * Works from either replay or live sources. Disabled if neither has data.
 */
export function ForkButton({ onOpenModal }: ForkButtonProps) {
  const sim = useSimulation();
  const replay = useReplay();
  const live = useLiveTiming();

  const handleClick = () => {
    if (!sim) return;

    // Prefer replay data when active; otherwise live.
    const replayActive = replay != null && replay.status !== "idle";
    const source = replayActive ? replay : live;
    if (!source) return;

    const drivers = source.drivers ?? [];
    const laps = source.laps ?? [];
    const stints = source.stints ?? [];
    const currentLap = source.lapCount?.current ?? 1;
    const totalLaps = source.lapCount?.total ?? currentLap + 20;

    if (drivers.length === 0) return;

    sim.fork({ drivers, laps, stints, currentLap, totalLaps });
    onOpenModal();
  };

  const canFork =
    sim != null &&
    ((replay != null && replay.status !== "idle" && replay.drivers != null) ||
      (live.connected && live.drivers != null));

  return (
    <button
      onClick={handleClick}
      disabled={!canFork}
      title="Fork race at this lap and run what-if scenarios"
      className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      style={{
        background: canFork
          ? "linear-gradient(135deg, rgba(168, 85, 247, 0.25) 0%, rgba(168, 85, 247, 0.08) 100%)"
          : "rgba(255,255,255,0.04)",
        border: canFork
          ? "1px solid rgba(168, 85, 247, 0.4)"
          : "1px solid rgba(255,255,255,0.08)",
        color: canFork ? "#c4a4ff" : "rgba(255,255,255,0.3)",
      }}
    >
      Fork
    </button>
  );
}
