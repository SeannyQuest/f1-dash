"use client";

import { useState } from "react";
import { useSimulation } from "@/contexts/SimulationContext";
import { useReplay } from "@/contexts/ReplayContext";
import { useLiveTiming } from "@/contexts/LiveTimingContext";
import type { Compound, Scenario, ScenarioType } from "@/types/simulation";

const SCENARIO_LABELS: Record<ScenarioType, string> = {
  ALT_PIT_WINDOW: "Alt pit window",
  ALT_COMPOUND: "Alt compound choice",
  SAFETY_CAR: "Inject safety car",
  DNF: "Driver retires",
};

const COMPOUNDS: Compound[] = ["SOFT", "MEDIUM", "HARD"];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ScenarioPickerModal({ open, onClose }: Props) {
  const sim = useSimulation();
  const replay = useReplay();
  const live = useLiveTiming();
  const [type, setType] = useState<ScenarioType>("ALT_PIT_WINDOW");
  const [driverNumber, setDriverNumber] = useState<number | "">("");
  const [lapInput, setLapInput] = useState<number | "">("");
  const [durationInput, setDurationInput] = useState<number>(3);
  const [compound, setCompound] = useState<Compound>("MEDIUM");

  if (!open || !sim) return null;

  const replayActive = replay != null && replay.status !== "idle";
  const source = replayActive ? replay : live;
  const drivers = source?.drivers ?? [];

  const forkLap = sim.state.forkLap ?? 1;
  const totalLaps = source?.lapCount?.total ?? forkLap + 20;

  const handleAdd = () => {
    if (type !== "SAFETY_CAR" && driverNumber === "") return;

    let scenario: Scenario | null = null;
    switch (type) {
      case "ALT_PIT_WINDOW":
        if (lapInput === "") return;
        scenario = {
          type: "ALT_PIT_WINDOW",
          driverNumber: Number(driverNumber),
          newPitLap: Number(lapInput),
          newCompound: compound,
        };
        break;
      case "ALT_COMPOUND":
        scenario = {
          type: "ALT_COMPOUND",
          driverNumber: Number(driverNumber),
          compound,
        };
        break;
      case "SAFETY_CAR":
        if (lapInput === "") return;
        scenario = {
          type: "SAFETY_CAR",
          atLap: Number(lapInput),
          durationLaps: durationInput,
        };
        break;
      case "DNF":
        if (lapInput === "") return;
        scenario = {
          type: "DNF",
          driverNumber: Number(driverNumber),
          atLap: Number(lapInput),
        };
        break;
    }
    if (scenario) sim.addScenario(scenario);
  };

  const handleRun = () => {
    sim.project();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-white/10 bg-[#0a0a0a] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-white/90 uppercase tracking-wider">
            Fork at lap {forkLap}
          </h2>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/80 text-xs"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-3 mb-4">
          <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider">
            Scenario type
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ScenarioType)}
            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-white/30"
          >
            {(Object.keys(SCENARIO_LABELS) as ScenarioType[]).map((t) => (
              <option key={t} value={t}>
                {SCENARIO_LABELS[t]}
              </option>
            ))}
          </select>

          {type !== "SAFETY_CAR" && (
            <>
              <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider">
                Driver
              </label>
              <select
                value={driverNumber}
                onChange={(e) =>
                  setDriverNumber(
                    e.target.value ? parseInt(e.target.value, 10) : "",
                  )
                }
                className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-white/30"
              >
                <option value="">Select…</option>
                {drivers.map((d) => (
                  <option key={d.driver_number} value={d.driver_number}>
                    #{d.driver_number} {d.name_acronym} — {d.team_name}
                  </option>
                ))}
              </select>
            </>
          )}

          {(type === "ALT_PIT_WINDOW" || type === "SAFETY_CAR" || type === "DNF") && (
            <>
              <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider">
                Lap {type === "SAFETY_CAR" ? "(SC starts)" : type === "DNF" ? "(retire)" : "(pit)"}
              </label>
              <input
                type="number"
                min={forkLap}
                max={totalLaps}
                value={lapInput}
                onChange={(e) =>
                  setLapInput(
                    e.target.value ? parseInt(e.target.value, 10) : "",
                  )
                }
                className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-white/30"
                placeholder={`${forkLap}-${totalLaps}`}
              />
            </>
          )}

          {type === "SAFETY_CAR" && (
            <>
              <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider">
                Duration (laps)
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={durationInput}
                onChange={(e) => setDurationInput(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-white/30"
              />
            </>
          )}

          {(type === "ALT_PIT_WINDOW" || type === "ALT_COMPOUND") && (
            <>
              <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider">
                Compound
              </label>
              <div className="flex gap-2">
                {COMPOUNDS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCompound(c)}
                    className="flex-1 py-1.5 rounded text-[10px] font-bold transition-colors"
                    style={{
                      background:
                        compound === c
                          ? "rgba(255,255,255,0.15)"
                          : "rgba(255,255,255,0.03)",
                      border:
                        compound === c
                          ? "1px solid rgba(255,255,255,0.3)"
                          : "1px solid rgba(255,255,255,0.08)",
                      color:
                        c === "SOFT" ? "#ff4444" : c === "MEDIUM" ? "#ffd000" : "#ffffff",
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <button
          onClick={handleAdd}
          className="w-full py-2 rounded text-[11px] font-bold uppercase tracking-wider text-white/80 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors mb-3"
        >
          + Add scenario
        </button>

        {sim.state.scenarios.length > 0 && (
          <div className="mb-4">
            <div className="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-2">
              Active scenarios ({sim.state.scenarios.length})
            </div>
            <div className="flex flex-col gap-1">
              {sim.state.scenarios.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-white/[0.03] border border-white/[0.06] rounded px-2 py-1 text-[10px]"
                >
                  <span className="text-white/80 font-mono">
                    {describeScenario(s)}
                  </span>
                  <button
                    onClick={() => sim.removeScenario(i)}
                    className="text-white/30 hover:text-white/80"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleRun}
          disabled={sim.state.scenarios.length === 0}
          className="w-full py-2.5 rounded text-[11px] font-black uppercase tracking-wider transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            background:
              "linear-gradient(135deg, rgba(168, 85, 247, 0.3) 0%, rgba(168, 85, 247, 0.1) 100%)",
            border: "1px solid rgba(168, 85, 247, 0.5)",
            color: "#e0c4ff",
          }}
        >
          Run simulation
        </button>
      </div>
    </div>
  );
}

function describeScenario(s: Scenario): string {
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
