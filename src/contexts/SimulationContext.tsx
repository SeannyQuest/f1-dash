"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { SimulationEngine, type ForkInput } from "@/lib/simulation-engine";
import type { Scenario, SimulationState } from "@/types/simulation";

interface SimulationContextData {
  state: SimulationState;
  fork: (input: ForkInput) => void;
  addScenario: (scenario: Scenario) => void;
  removeScenario: (index: number) => void;
  clearScenarios: () => void;
  project: () => void;
  reset: () => void;
}

const SimulationContext = createContext<SimulationContextData | null>(null);

export function useSimulation(): SimulationContextData | null {
  return useContext(SimulationContext);
}

export function SimulationProvider({ children }: { children: ReactNode }) {
  const engineRef = useRef<SimulationEngine | null>(null);
  const [state, setState] = useState<SimulationState>({
    status: "idle",
    forkLap: null,
    scenarios: [],
    timeline: null,
    actualTimeline: null,
    diff: null,
  });

  useEffect(() => {
    const engine = new SimulationEngine();
    engineRef.current = engine;
    const unsub = engine.subscribe(setState);
    return () => {
      unsub();
    };
  }, []);

  const fork = useCallback((input: ForkInput) => {
    engineRef.current?.forkFrom(input);
  }, []);

  const addScenario = useCallback((scenario: Scenario) => {
    engineRef.current?.addScenario(scenario);
  }, []);

  const removeScenario = useCallback((index: number) => {
    engineRef.current?.removeScenario(index);
  }, []);

  const clearScenarios = useCallback(() => {
    engineRef.current?.clearScenarios();
  }, []);

  const project = useCallback(() => {
    engineRef.current?.project();
  }, []);

  const reset = useCallback(() => {
    engineRef.current?.reset();
  }, []);

  return (
    <SimulationContext.Provider
      value={{ state, fork, addScenario, removeScenario, clearScenarios, project, reset }}
    >
      {children}
    </SimulationContext.Provider>
  );
}
