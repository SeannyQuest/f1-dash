/**
 * SimulationEngine — fork a race at a given lap and project forward under
 * hypothetical scenarios.
 *
 * Lives in parallel to ReplayEngine (not inheritance). Takes a snapshot-by-value
 * of the replay state at fork time, so the replay can continue playing
 * independently after the fork.
 */

import type { Driver, Lap, Stint } from "@/types";
import type {
  Compound,
  DriverSimState,
  Scenario,
  SimulatedLap,
  SimulatedTimeline,
  SimulationDiff,
  SimulationState,
} from "@/types/simulation";
import {
  SIM_CONSTANTS,
  advanceLap,
  applyPitCompoundChange,
} from "./simulation-model";

// ── Inputs to a fork ───────────────────────────────────────────────────────

export interface ForkInput {
  drivers: Driver[];
  /** All laps recorded so far for every driver (from replay or live state). */
  laps: Lap[];
  /** Current stints with compound + lap ranges. */
  stints: Stint[];
  /** Current race lap number (1-indexed). */
  currentLap: number;
  /** Total laps in the race (for projection horizon). */
  totalLaps: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Estimate per-driver base pace from recent clean laps.
 * Uses the median of the driver's 5 most recent non-pit laps,
 * discounted to what a "reference" (medium tyres, half-tank) would run.
 */
function estimateBasePace(driverNumber: number, laps: Lap[]): number {
  const driverLaps = laps
    .filter(
      (l) =>
        l.driver_number === driverNumber &&
        !l.is_pit_out_lap &&
        l.lap_duration != null &&
        l.lap_duration > 0 &&
        l.lap_duration < 300,
    )
    .sort((a, b) => b.lap_number - a.lap_number)
    .slice(0, 5);

  if (driverLaps.length === 0) {
    // Fall back to field median
    const allLapTimes = laps
      .filter(
        (l) =>
          !l.is_pit_out_lap &&
          l.lap_duration != null &&
          l.lap_duration > 0 &&
          l.lap_duration < 300,
      )
      .map((l) => l.lap_duration as number)
      .sort((a, b) => a - b);
    if (allLapTimes.length === 0) return 90; // generic fallback
    return allLapTimes[Math.floor(allLapTimes.length / 2)];
  }

  const durations = driverLaps
    .map((l) => l.lap_duration as number)
    .sort((a, b) => a - b);
  return durations[Math.floor(durations.length / 2)];
}

function extractCurrentCompound(
  driverNumber: number,
  stints: Stint[],
): Compound {
  const driverStints = stints
    .filter((s) => s.driver_number === driverNumber)
    .sort((a, b) => b.lap_start - a.lap_start);
  return (driverStints[0]?.compound ?? "MEDIUM") as Compound;
}

function extractTyreAge(
  driverNumber: number,
  stints: Stint[],
  currentLap: number,
): number {
  const driverStints = stints
    .filter((s) => s.driver_number === driverNumber)
    .sort((a, b) => b.lap_start - a.lap_start);
  const current = driverStints[0];
  if (!current) return 0;
  return Math.max(0, currentLap - current.lap_start);
}

/**
 * Build initial DriverSimState[] from race data at the fork point.
 * Drivers are ordered by their last-known position if available.
 */
function buildInitialGrid(input: ForkInput): DriverSimState[] {
  const { drivers, laps, stints, currentLap } = input;

  // Cumulative race time per driver: sum of their lap durations so far.
  // Safer than trusting any single time field from the stream.
  const cumulative = new Map<number, number>();
  for (const lap of laps) {
    if (lap.lap_duration == null) continue;
    cumulative.set(
      lap.driver_number,
      (cumulative.get(lap.driver_number) ?? 0) + lap.lap_duration,
    );
  }

  const fuelAtFork =
    SIM_CONSTANTS.FUEL_START_KG -
    SIM_CONSTANTS.FUEL_BURN_PER_LAP * (currentLap - 1);

  const rawStates: DriverSimState[] = drivers.map((d) => {
    const basePace = estimateBasePace(d.driver_number, laps);
    const compound = extractCurrentCompound(d.driver_number, stints);
    const tyreAge = extractTyreAge(d.driver_number, stints, currentLap);
    return {
      driverNumber: d.driver_number,
      basePace,
      compound,
      tyreAge,
      fuelKg: Math.max(0, fuelAtFork),
      cumulativeTime: cumulative.get(d.driver_number) ?? 0,
      position: 0, // filled after sort below
      nextPitLap: null,
      retired: false,
    };
  });

  return rawStates
    .sort((a, b) => a.cumulativeTime - b.cumulativeTime)
    .map((d, i) => ({ ...d, position: i + 1 }));
}

/**
 * Apply scenario inputs to the initial grid (e.g., alt pit window sets nextPitLap).
 */
function seedScenarios(
  grid: DriverSimState[],
  scenarios: Scenario[],
): DriverSimState[] {
  const map = new Map(grid.map((d) => [d.driverNumber, { ...d }]));
  for (const s of scenarios) {
    if (s.type === "ALT_PIT_WINDOW") {
      const d = map.get(s.driverNumber);
      if (d) {
        d.nextPitLap = s.newPitLap;
        map.set(s.driverNumber, d);
      }
    } else if (s.type === "ALT_COMPOUND") {
      const d = map.get(s.driverNumber);
      if (d) {
        d.compound = s.compound;
        map.set(s.driverNumber, d);
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.position - b.position);
}

// ── Engine ─────────────────────────────────────────────────────────────────

export class SimulationEngine {
  private state: SimulationState = {
    status: "idle",
    forkLap: null,
    scenarios: [],
    timeline: null,
    actualTimeline: null,
    diff: null,
  };
  private listeners = new Set<(s: SimulationState) => void>();
  private fork: ForkInput | null = null;

  subscribe(listener: (s: SimulationState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const l of this.listeners) l(this.state);
  }

  private update(partial: Partial<SimulationState>): void {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  getState(): SimulationState {
    return this.state;
  }

  /**
   * Capture a fork point. Call this when the user clicks "Fork" in the UI
   * while the replay is paused at some lap.
   */
  forkFrom(input: ForkInput): void {
    this.fork = input;
    this.update({
      status: "forked",
      forkLap: input.currentLap,
      scenarios: [],
      timeline: null,
      diff: null,
      error: undefined,
    });
  }

  addScenario(scenario: Scenario): void {
    if (this.state.status === "idle") return;
    this.update({ scenarios: [...this.state.scenarios, scenario] });
  }

  removeScenario(index: number): void {
    this.update({
      scenarios: this.state.scenarios.filter((_, i) => i !== index),
    });
  }

  clearScenarios(): void {
    this.update({ scenarios: [] });
  }

  reset(): void {
    this.fork = null;
    this.update({
      status: "idle",
      forkLap: null,
      scenarios: [],
      timeline: null,
      actualTimeline: null,
      diff: null,
    });
  }

  /**
   * Run the projection from the fork point to the end of the race.
   */
  project(): SimulatedTimeline | null {
    if (!this.fork) return null;
    this.update({ status: "simulating", error: undefined });

    try {
      const initialGrid = seedScenarios(
        buildInitialGrid(this.fork),
        this.state.scenarios,
      );
      const totalLaps = this.fork.totalLaps;
      const forkLap = this.fork.currentLap;

      // Identify SC windows from scenarios.
      const scWindows = this.state.scenarios
        .filter((s): s is Extract<Scenario, { type: "SAFETY_CAR" }> => s.type === "SAFETY_CAR")
        .map((s) => ({ from: s.atLap, to: s.atLap + s.durationLaps }));

      const laps: SimulatedLap[] = [];
      let grid = initialGrid;

      for (let lapNum = forkLap; lapNum <= totalLaps; lapNum++) {
        const scActive = scWindows.some((w) => lapNum >= w.from && lapNum < w.to);
        const result = advanceLap(grid, { lapNumber: lapNum, safetyCarActive: scActive }, this.state.scenarios);
        // Apply compound changes from scenarios on pit laps.
        const postPit = applyPitCompoundChange(
          result.grid,
          result.pitFlags,
          this.state.scenarios,
          lapNum,
        );

        const leader = postPit.find((d) => !d.retired);
        const leaderTime = leader?.cumulativeTime ?? 0;

        postPit.forEach((d, idx) => {
          if (d.retired && lapNum > forkLap) {
            // Still emit a row so UI can show retirement
            laps.push({
              driverNumber: d.driverNumber,
              lapNumber: lapNum,
              lapTime: 0,
              cumulativeTime: d.cumulativeTime,
              position: 0,
              gapToLeader: 0,
              compound: d.compound,
              tyreAge: d.tyreAge,
              pitThisLap: false,
              retired: true,
              isCounterfactual: true,
            });
            return;
          }
          laps.push({
            driverNumber: d.driverNumber,
            lapNumber: lapNum,
            lapTime: result.lapTimes[idx] ?? 0,
            cumulativeTime: d.cumulativeTime,
            position: d.position,
            gapToLeader: d.cumulativeTime - leaderTime,
            compound: d.compound,
            tyreAge: d.tyreAge,
            pitThisLap: result.pitFlags[idx] ?? false,
            retired: false,
            isCounterfactual: lapNum > forkLap,
          });
        });

        grid = postPit;
      }

      const timeline: SimulatedTimeline = {
        forkLap,
        endLap: totalLaps,
        laps,
        scenarios: this.state.scenarios,
        driverList: this.fork.drivers,
      };

      // Build the "actual" timeline from real lap data for comparison.
      const actualTimeline = this.buildActualTimeline(this.fork, forkLap, totalLaps);
      const diff = actualTimeline ? this.computeDiff(actualTimeline, timeline, forkLap) : null;

      this.update({
        status: "ready",
        timeline,
        actualTimeline,
        diff,
      });
      return timeline;
    } catch (err) {
      this.update({ status: "error", error: (err as Error).message });
      return null;
    }
  }

  /**
   * Reshape the real lap data into the same SimulatedTimeline structure
   * so the UI can compare side-by-side.
   */
  private buildActualTimeline(
    input: ForkInput,
    forkLap: number,
    totalLaps: number,
  ): SimulatedTimeline | null {
    const { laps: rawLaps, drivers, stints } = input;

    const actualLaps: SimulatedLap[] = [];
    // Cumulative sums per driver.
    const cum = new Map<number, number>();

    const byLap = new Map<number, Lap[]>();
    for (const l of rawLaps) {
      if (!byLap.has(l.lap_number)) byLap.set(l.lap_number, []);
      byLap.get(l.lap_number)!.push(l);
    }

    for (let lap = 1; lap <= totalLaps; lap++) {
      const lapEntries = byLap.get(lap);
      if (!lapEntries || lapEntries.length === 0) continue;

      // Update cumulative for every driver that has a lap at this number.
      for (const e of lapEntries) {
        if (e.lap_duration != null) {
          cum.set(
            e.driver_number,
            (cum.get(e.driver_number) ?? 0) + e.lap_duration,
          );
        }
      }

      // Compute positions by cumulative time.
      const entries = Array.from(cum.entries()).sort((a, b) => a[1] - b[1]);
      const leaderTime = entries[0]?.[1] ?? 0;
      entries.forEach(([driverNumber, cumTime], idx) => {
        const e = lapEntries.find((l) => l.driver_number === driverNumber);
        const compound = extractCurrentCompound(driverNumber, stints);
        actualLaps.push({
          driverNumber,
          lapNumber: lap,
          lapTime: e?.lap_duration ?? 0,
          cumulativeTime: cumTime,
          position: idx + 1,
          gapToLeader: cumTime - leaderTime,
          compound,
          tyreAge: 0,
          pitThisLap: false,
          retired: false,
          isCounterfactual: false,
        });
      });
    }

    return {
      forkLap,
      endLap: totalLaps,
      laps: actualLaps,
      scenarios: [],
      driverList: drivers,
    };
  }

  private computeDiff(
    actual: SimulatedTimeline,
    sim: SimulatedTimeline,
    forkLap: number,
  ): SimulationDiff {
    const perDriver: SimulationDiff["perDriver"] = {};

    const actualByDriverLap = new Map<string, SimulatedLap>();
    for (const l of actual.laps) {
      actualByDriverLap.set(`${l.driverNumber}:${l.lapNumber}`, l);
    }

    const drivers = new Set(sim.laps.map((l) => l.driverNumber));

    for (const dn of drivers) {
      const simFinal = [...sim.laps]
        .filter((l) => l.driverNumber === dn)
        .sort((a, b) => b.lapNumber - a.lapNumber)[0];
      const actualFinal = [...actual.laps]
        .filter((l) => l.driverNumber === dn)
        .sort((a, b) => b.lapNumber - a.lapNumber)[0];

      if (!simFinal || !actualFinal) continue;

      let maxDivergence = 0;
      const significantEvents: Array<{ lap: number; description: string }> = [];

      for (
        let lap = forkLap;
        lap <= Math.min(sim.endLap, actual.endLap);
        lap++
      ) {
        const s = sim.laps.find((l) => l.driverNumber === dn && l.lapNumber === lap);
        const a = actualByDriverLap.get(`${dn}:${lap}`);
        if (!s || !a) continue;
        const posDelta = a.position - s.position;
        if (Math.abs(posDelta) > Math.abs(maxDivergence)) {
          maxDivergence = posDelta;
        }
        if (Math.abs(posDelta) >= 3 && significantEvents.length < 3) {
          significantEvents.push({
            lap,
            description: `P${a.position} → P${s.position}`,
          });
        }
      }

      perDriver[dn] = {
        finalPositionDelta: actualFinal.position - simFinal.position,
        finalGapDelta: simFinal.gapToLeader - actualFinal.gapToLeader,
        maxDivergence,
        significantEvents,
      };
    }

    return { forkLap, perDriver };
  }
}
