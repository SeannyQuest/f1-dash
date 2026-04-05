/**
 * Pure, deterministic physics/strategy model for race simulation.
 *
 * Constants are directional, not exact. The goal is to produce plausible
 * counterfactuals — not to predict real race outcomes to the tenth. Users
 * should read simulation output as "ballpark what-if", not fact.
 *
 * All functions in this file are pure and have no IO. They can be unit-tested
 * in isolation without React or any runtime state.
 */

import type { Compound, DriverSimState, Scenario } from "@/types/simulation";

// ── Constants ──────────────────────────────────────────────────────────────

export const SIM_CONSTANTS = {
  /** Tyre degradation in seconds added per lap of age, per compound. */
  TYRE_DEG: {
    SOFT: 0.12,
    MEDIUM: 0.06,
    HARD: 0.03,
    INTERMEDIATE: 0.15,
    WET: 0.18,
  } as Record<Compound, number>,

  /** Compound pace offset in seconds vs the reference (MEDIUM = 0). */
  COMPOUND_OFFSET: {
    SOFT: -0.8,
    MEDIUM: 0,
    HARD: 0.5,
    INTERMEDIATE: 2.5,
    WET: 4.0,
  } as Record<Compound, number>,

  /** Penalty per kg of fuel in seconds per lap. */
  FUEL_PENALTY_PER_KG: 0.03,
  /** Fuel burned per lap in kg (averaged). */
  FUEL_BURN_PER_LAP: 1.8,
  /** Starting fuel load in kg. */
  FUEL_START_KG: 110,

  /** Total time lost per pit stop in seconds (entry + stop + exit). */
  PIT_STOP_LOSS: 21,

  /** Gap threshold below which a car is stuck behind another. */
  TRAFFIC_THRESHOLD_SEC: 1.0,
  /** Extra lap time penalty when in traffic without DRS. */
  TRAFFIC_PENALTY: 0.3,

  /** Gap between cars under Safety Car in seconds. */
  SC_BUNCH_GAP: 1.0,
  /** Lap time penalty during SC laps (in seconds). */
  SC_LAP_PENALTY: 25,
};

// ── Core per-lap computation ───────────────────────────────────────────────

export interface TrafficContext {
  /** Gap to the car directly ahead in seconds, or Infinity if leading. */
  gapAhead: number;
  /** True if this car can use DRS this lap (simplified: within 1s and a DRS lap). */
  drsAvailable: boolean;
}

export interface LapEnvironment {
  lapNumber: number;
  /** True if a Safety Car is active during this lap. */
  safetyCarActive: boolean;
}

/**
 * Compute the lap time for a driver under given conditions.
 * Pure function — no IO, no side effects.
 */
export function computeLapTime(
  d: DriverSimState,
  env: LapEnvironment,
  traffic: TrafficContext,
): number {
  if (d.retired) return 0;

  // Safety car laps run at a controlled pace — everyone slows to the same delta.
  if (env.safetyCarActive) {
    return d.basePace + SIM_CONSTANTS.SC_LAP_PENALTY;
  }

  const compoundOffset = SIM_CONSTANTS.COMPOUND_OFFSET[d.compound];
  const tyrePenalty = SIM_CONSTANTS.TYRE_DEG[d.compound] * d.tyreAge;
  const fuelPenalty = d.fuelKg * SIM_CONSTANTS.FUEL_PENALTY_PER_KG;

  const trafficPenalty =
    traffic.gapAhead < SIM_CONSTANTS.TRAFFIC_THRESHOLD_SEC && !traffic.drsAvailable
      ? SIM_CONSTANTS.TRAFFIC_PENALTY
      : 0;

  return d.basePace + compoundOffset + tyrePenalty + fuelPenalty + trafficPenalty;
}

// ── Advance one lap for all drivers ────────────────────────────────────────

export interface AdvanceLapResult {
  /** Updated grid state after the lap. */
  grid: DriverSimState[];
  /** Per-driver lap times for this lap, in driver order matching `grid`. */
  lapTimes: number[];
  /** Per-driver `pitThisLap` flags, matching `grid`. */
  pitFlags: boolean[];
}

/**
 * Advance the entire grid by one lap. Returns new state (does not mutate).
 *
 * The input grid should already be sorted by current position. The output grid
 * is re-sorted by cumulative race time after this lap.
 */
export function advanceLap(
  grid: DriverSimState[],
  env: LapEnvironment,
  scenarios: Scenario[] = [],
): AdvanceLapResult {
  // Compute gap ahead for each driver in their current order.
  const gapsAhead: number[] = [];
  for (let i = 0; i < grid.length; i++) {
    if (i === 0) gapsAhead.push(Infinity);
    else gapsAhead.push(grid[i].cumulativeTime - grid[i - 1].cumulativeTime);
  }

  const newGrid: DriverSimState[] = [];
  const lapTimes: number[] = [];
  const pitFlags: boolean[] = [];

  for (let i = 0; i < grid.length; i++) {
    const d = grid[i];
    const retiredByScenario = scenarios.some(
      (s) =>
        s.type === "DNF" &&
        s.driverNumber === d.driverNumber &&
        env.lapNumber >= s.atLap,
    );

    if (d.retired || retiredByScenario) {
      newGrid.push({ ...d, retired: true });
      lapTimes.push(0);
      pitFlags.push(false);
      continue;
    }

    // Determine if this is a pit lap
    const pitThisLap = d.nextPitLap === env.lapNumber;

    // DRS: simplified — available if gap to car ahead < 1s and we're past lap 3.
    const drsAvailable =
      env.lapNumber > 3 && gapsAhead[i] < SIM_CONSTANTS.TRAFFIC_THRESHOLD_SEC;

    const baseLapTime = computeLapTime(
      d,
      env,
      { gapAhead: gapsAhead[i], drsAvailable },
    );

    const lapTime = pitThisLap ? baseLapTime + SIM_CONSTANTS.PIT_STOP_LOSS : baseLapTime;
    lapTimes.push(lapTime);
    pitFlags.push(pitThisLap);

    // Post-lap state update
    const newFuel = Math.max(0, d.fuelKg - SIM_CONSTANTS.FUEL_BURN_PER_LAP);
    const newTyreAge = pitThisLap ? 0 : d.tyreAge + 1;
    const nextPitLapCleared = pitThisLap ? null : d.nextPitLap;

    newGrid.push({
      ...d,
      cumulativeTime: d.cumulativeTime + lapTime,
      fuelKg: newFuel,
      tyreAge: newTyreAge,
      nextPitLap: nextPitLapCleared,
      // compound change on pit is applied by scenario hooks, not here
    });
  }

  // Re-sort by cumulative time to derive new positions.
  const ordered = [...newGrid]
    .filter((d) => !d.retired)
    .sort((a, b) => a.cumulativeTime - b.cumulativeTime)
    .map((d, idx) => ({ ...d, position: idx + 1 }));

  const retired = newGrid.filter((d) => d.retired);

  // Safety car bunching: if SC ends this lap, compress gaps.
  // (We keep this minimal: always apply SC_BUNCH_GAP between cars during SC laps.)
  if (env.safetyCarActive && ordered.length > 0) {
    let t = ordered[0].cumulativeTime;
    for (let i = 1; i < ordered.length; i++) {
      t += SIM_CONSTANTS.SC_BUNCH_GAP;
      ordered[i] = { ...ordered[i], cumulativeTime: t };
    }
  }

  return {
    grid: [...ordered, ...retired],
    lapTimes,
    pitFlags,
  };
}

/**
 * Apply compound swap from scenarios on pit laps.
 * Called between advanceLap() and the next iteration so the new compound
 * is in effect for the following lap.
 */
export function applyPitCompoundChange(
  grid: DriverSimState[],
  pitFlags: boolean[],
  scenarios: Scenario[],
  lapNumber: number,
): DriverSimState[] {
  return grid.map((d, i) => {
    if (!pitFlags[i]) return d;
    // Find a scenario that assigns a compound for this pit.
    const altPit = scenarios.find(
      (s): s is import("@/types/simulation").AltPitWindowScenario =>
        s.type === "ALT_PIT_WINDOW" &&
        s.driverNumber === d.driverNumber &&
        s.newPitLap === lapNumber &&
        s.newCompound !== undefined,
    );
    if (altPit?.newCompound) {
      return { ...d, compound: altPit.newCompound };
    }
    return d;
  });
}
