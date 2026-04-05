/**
 * Types for the race simulation layer.
 *
 * The simulation "forks" a race at a given lap, clones the current state,
 * applies a hypothetical scenario, and projects forward using a simple
 * physics/strategy model. Results are shape-compatible with real race data
 * so the same panels (TimingTower, LapTimeChart) can render them.
 */

import type { Driver } from "@/types";

export type Compound = "SOFT" | "MEDIUM" | "HARD" | "INTERMEDIATE" | "WET";

/**
 * Per-driver state during a simulation tick. Tracked per lap.
 */
export interface DriverSimState {
  driverNumber: number;
  /** Clean-air pace in seconds per lap with medium tyres, full tank. */
  basePace: number;
  compound: Compound;
  /** Laps on the current tyre set. */
  tyreAge: number;
  /** Current fuel load in kg. */
  fuelKg: number;
  /** Cumulative race time in seconds (for gap calculation). */
  cumulativeTime: number;
  position: number;
  /** Upcoming pit lap. null if not scheduled this stint. */
  nextPitLap: number | null;
  retired: boolean;
}

export type ScenarioType =
  | "ALT_PIT_WINDOW"
  | "ALT_COMPOUND"
  | "SAFETY_CAR"
  | "DNF";

export interface AltPitWindowScenario {
  type: "ALT_PIT_WINDOW";
  driverNumber: number;
  /** The lap on which the driver pits in the counterfactual. */
  newPitLap: number;
  /** Compound to fit at the alt stop (defaults to whatever the driver was on). */
  newCompound?: Compound;
}

export interface AltCompoundScenario {
  type: "ALT_COMPOUND";
  driverNumber: number;
  compound: Compound;
}

export interface SafetyCarScenario {
  type: "SAFETY_CAR";
  atLap: number;
  durationLaps: number;
}

export interface DnfScenario {
  type: "DNF";
  driverNumber: number;
  atLap: number;
}

export type Scenario =
  | AltPitWindowScenario
  | AltCompoundScenario
  | SafetyCarScenario
  | DnfScenario;

/**
 * A single simulated lap for a driver in a projected race.
 */
export interface SimulatedLap {
  driverNumber: number;
  lapNumber: number;
  /** Lap time in seconds for this lap. */
  lapTime: number;
  /** Cumulative race time in seconds at the end of this lap. */
  cumulativeTime: number;
  position: number;
  /** Gap to the leader in seconds. */
  gapToLeader: number;
  compound: Compound;
  tyreAge: number;
  pitThisLap: boolean;
  retired: boolean;
  /** True if this lap differs from the real race (i.e. post-fork lap). */
  isCounterfactual: boolean;
}

/**
 * A full simulated timeline from fork point to race end.
 */
export interface SimulatedTimeline {
  /** Lap at which the fork was taken (1-indexed). */
  forkLap: number;
  /** Last lap in the timeline. */
  endLap: number;
  /** All simulated laps, sorted by (lapNumber, position). */
  laps: SimulatedLap[];
  /** Scenarios applied to produce this timeline. */
  scenarios: Scenario[];
  driverList: Driver[];
}

/**
 * Divergence between a simulated timeline and the actual race.
 * Only populated when both actual and simulated data exist for overlapping laps.
 */
export interface SimulationDiff {
  forkLap: number;
  perDriver: Record<
    number,
    {
      finalPositionDelta: number;
      finalGapDelta: number;
      maxDivergence: number;
      /** Key moments where the counterfactual meaningfully diverges. */
      significantEvents: Array<{ lap: number; description: string }>;
    }
  >;
}

export interface SimulationState {
  status: "idle" | "forked" | "simulating" | "ready" | "error";
  forkLap: number | null;
  scenarios: Scenario[];
  timeline: SimulatedTimeline | null;
  actualTimeline: SimulatedTimeline | null;
  diff: SimulationDiff | null;
  error?: string;
}
