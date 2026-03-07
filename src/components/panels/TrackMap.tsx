"use client";

import { useEffect, useMemo, useState } from "react";
import { PanelWrapper } from "@/components/layout/PanelWrapper";
import { useDrivers } from "@/hooks/useF1Data";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useLiveTiming } from "@/contexts/LiveTimingContext";
import { useReplay } from "@/contexts/ReplayContext";

interface TrackMapProps {
  sessionKey: string | null;
  circuitKey: string | null;
  year: string | null;
  isLive: boolean;
  refetchInterval: number | false;
}

interface CircuitData {
  x: number[];
  y: number[];
  corners: {
    number: number;
    letter: string;
    x: number;
    y: number;
    angle: number;
  }[];
}

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

const PADDING = 60;
const VIEW_SIZE = 800;

function computeBounds(x: number[], y: number[]): Bounds {
  const minX = Math.min(...x);
  const maxX = Math.max(...x);
  const minY = Math.min(...y);
  const maxY = Math.max(...y);
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

function transformPoint(
  px: number,
  py: number,
  bounds: Bounds,
): { x: number; y: number } {
  const scale =
    (VIEW_SIZE - PADDING * 2) / Math.max(bounds.width, bounds.height);
  const offsetX = (VIEW_SIZE - bounds.width * scale) / 2;
  const offsetY = (VIEW_SIZE - bounds.height * scale) / 2;
  return {
    x: (px - bounds.minX) * scale + offsetX,
    y: (py - bounds.minY) * scale + offsetY,
  };
}

export function TrackMap({
  sessionKey,
  circuitKey,
  year,
  isLive,
}: TrackMapProps) {
  const { data: drivers } = useDrivers(sessionKey);
  const { locations: wsLocations, connected } = useWebSocket(sessionKey);
  const liveTiming = useLiveTiming();
  const replay = useReplay();

  // Priority: Replay positions → SignalR → Railway WS relay
  const replayActive = replay != null && replay.status !== "idle";
  const locations =
    replayActive && replay.trackPositions.length > 0
      ? replay.trackPositions
      : liveTiming.connected && liveTiming.trackPositions.length > 0
        ? liveTiming.trackPositions
        : wsLocations;
  const [circuit, setCircuit] = useState<CircuitData | null>(null);
  const [circuitLoading, setCircuitLoading] = useState(false);

  // Fetch circuit data when circuit key changes
  useEffect(() => {
    if (!circuitKey) {
      setCircuit(null);
      return;
    }

    let cancelled = false;

    async function loadCircuit() {
      setCircuitLoading(true);
      try {
        const circRes = await fetch(
          `/api/f1/circuit?circuit_key=${circuitKey}&year=${year || new Date().getFullYear()}`,
        );
        if (cancelled || !circRes.ok) return;

        const data = await circRes.json();
        if (!cancelled && data.x && data.y) {
          setCircuit(data);
        }
      } catch {
        // Fall back to no circuit data
      } finally {
        if (!cancelled) setCircuitLoading(false);
      }
    }

    loadCircuit();
    return () => {
      cancelled = true;
    };
  }, [circuitKey, year]);

  const bounds = useMemo(() => {
    if (!circuit) return null;
    return computeBounds(circuit.x, circuit.y);
  }, [circuit]);

  // Build the track outline path
  const trackPath = useMemo(() => {
    if (!circuit || !bounds) return "";
    const points = circuit.x.map((x, i) => {
      const p = transformPoint(x, circuit.y[i], bounds);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    });
    return `M ${points.join(" L ")} Z`;
  }, [circuit, bounds]);

  // Map driver locations to screen positions
  const driverDots = useMemo(() => {
    if (!bounds || !drivers) return [];

    const driverMap = new Map(drivers.map((d) => [d.driver_number, d]));

    return locations
      .filter((loc) => driverMap.has(loc.driver_number))
      .map((loc) => {
        const driver = driverMap.get(loc.driver_number)!;
        const pos = transformPoint(loc.x, loc.y, bounds);
        const color = driver.team_colour.startsWith("#")
          ? driver.team_colour
          : `#${driver.team_colour}`;
        return {
          key: loc.driver_number,
          x: pos.x,
          y: pos.y,
          color,
          acronym: driver.name_acronym,
        };
      });
  }, [locations, bounds, drivers]);

  // Transform corner positions
  const corners = useMemo(() => {
    if (!circuit?.corners || !bounds) return [];
    return circuit.corners.map((c) => {
      const pos = transformPoint(c.x, c.y, bounds);
      return { number: c.number, x: pos.x, y: pos.y };
    });
  }, [circuit, bounds]);

  const carCount = locations.length;

  if (!sessionKey) {
    return (
      <PanelWrapper title="Track" isLive={isLive} className="h-full">
        <p className="text-white/20 text-xs">Select a session</p>
      </PanelWrapper>
    );
  }

  return (
    <PanelWrapper
      title="Track"
      isLive={isLive}
      className="h-full"
      rightSection={
        carCount > 0 ? (
          <span className="text-[10px] font-mono text-white/25">
            {carCount} cars
          </span>
        ) : undefined
      }
    >
      {circuitLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-white/20 text-xs">Loading circuit...</div>
        </div>
      ) : !circuit ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-white/20 text-xs">No circuit data</div>
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
          className="w-full h-full max-h-full object-contain"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Track surface glow */}
          <path
            d={trackPath}
            fill="none"
            stroke="rgba(255,215,0,0.06)"
            strokeWidth="32"
            strokeLinejoin="round"
          />
          {/* Track outline — yellow/gold like F1 TV */}
          <path
            d={trackPath}
            fill="none"
            stroke="rgba(255,215,0,0.45)"
            strokeWidth="22"
            strokeLinejoin="round"
          />
          {/* Track center line */}
          <path
            d={trackPath}
            fill="none"
            stroke="rgba(15,17,26,0.6)"
            strokeWidth="1"
            strokeDasharray="6 4"
          />

          {/* Corner numbers */}
          {corners.map((c) => (
            <g key={`corner-${c.number}`}>
              <circle cx={c.x} cy={c.y} r={9} fill="rgba(255,255,255,0.07)" />
              <text
                x={c.x}
                y={c.y + 1}
                textAnchor="middle"
                dominantBaseline="central"
                fill="rgba(255,255,255,0.35)"
                fontSize="7"
                fontFamily="monospace"
                fontWeight="600"
              >
                {c.number}
              </text>
            </g>
          ))}

          {/* Driver dots */}
          {driverDots.map((dot) => (
            <g key={dot.key}>
              {/* Outer glow */}
              <circle cx={dot.x} cy={dot.y} r={18} fill={`${dot.color}20`} />
              {/* Drop shadow */}
              <circle cx={dot.x} cy={dot.y + 1} r={11} fill="rgba(0,0,0,0.4)" />
              {/* Car dot */}
              <circle
                cx={dot.x}
                cy={dot.y}
                r={11}
                fill={dot.color}
                stroke="rgba(0,0,0,0.7)"
                strokeWidth={1.5}
              />
              {/* Driver abbreviation */}
              <text
                x={dot.x}
                y={dot.y + 0.5}
                textAnchor="middle"
                dominantBaseline="central"
                fill="white"
                fontSize="7"
                fontWeight="bold"
                fontFamily="monospace"
                style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
              >
                {dot.acronym}
              </text>
            </g>
          ))}

          {/* Start/Finish marker */}
          {circuit.x.length > 0 &&
            bounds &&
            (() => {
              const sf = transformPoint(circuit.x[0], circuit.y[0], bounds);
              return (
                <g>
                  {/* Checkered pattern hint */}
                  <rect
                    x={sf.x - 14}
                    y={sf.y - 18}
                    width={28}
                    height={11}
                    rx={2}
                    fill="rgba(255,255,255,0.12)"
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth={0.5}
                  />
                  <text
                    x={sf.x}
                    y={sf.y - 11.5}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="rgba(255,255,255,0.5)"
                    fontSize="7"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    S/F
                  </text>
                </g>
              );
            })()}
        </svg>
      )}
    </PanelWrapper>
  );
}
