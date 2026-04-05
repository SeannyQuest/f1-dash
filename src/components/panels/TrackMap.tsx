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
        <div
          className="w-full h-full"
          style={{
            background:
              "radial-gradient(ellipse at center, #0e1e36 0%, #060d1c 85%)",
          }}
        >
          <svg
            viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
            className="w-full h-full max-h-full object-contain"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Infield fill — dark green like F1 TV's grass */}
            <path
              d={trackPath}
              fill="#1a3626"
              stroke="none"
              fillOpacity="0.55"
            />

            {/* Track edge (white kerb line — outer) */}
            <path
              d={trackPath}
              fill="none"
              stroke="#ffffff"
              strokeWidth="30"
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity="0.9"
            />
            {/* Track surface — desaturated cyan asphalt */}
            <path
              d={trackPath}
              fill="none"
              stroke="#5ba6a6"
              strokeWidth="26"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {/* Track center highlight (subtle) */}
            <path
              d={trackPath}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeDasharray="10 8"
            />

            {/* Corner numbers */}
            {corners.map((c) => (
              <g key={`corner-${c.number}`}>
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={10}
                  fill="#0a1628"
                  stroke="rgba(255,255,255,0.35)"
                  strokeWidth="1"
                />
                <text
                  x={c.x}
                  y={c.y + 1}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="rgba(255,255,255,0.75)"
                  fontSize="8"
                  fontFamily="monospace"
                  fontWeight="700"
                >
                  {c.number}
                </text>
              </g>
            ))}

            {/* Start/Finish — checkered block at turn 1 */}
            {circuit.x.length > 0 &&
              bounds &&
              (() => {
                const sf = transformPoint(circuit.x[0], circuit.y[0], bounds);
                // Checker pattern: 2 rows x 4 cols of alternating squares
                const cellW = 5;
                const cellH = 5;
                const startX = sf.x - cellW * 2;
                const startY = sf.y - cellH - 18;
                const cells = [];
                for (let r = 0; r < 2; r++) {
                  for (let c = 0; c < 4; c++) {
                    cells.push(
                      <rect
                        key={`sf-${r}-${c}`}
                        x={startX + c * cellW}
                        y={startY + r * cellH}
                        width={cellW}
                        height={cellH}
                        fill={(r + c) % 2 === 0 ? "#ffffff" : "#0a1628"}
                      />,
                    );
                  }
                }
                return (
                  <g>
                    {cells}
                    <line
                      x1={sf.x}
                      y1={startY + cellH * 2 + 1}
                      x2={sf.x}
                      y2={sf.y}
                      stroke="rgba(255,255,255,0.5)"
                      strokeWidth="1"
                    />
                  </g>
                );
              })()}

            {/* Driver dots */}
            {driverDots.map((dot) => (
              <g key={dot.key}>
                {/* Outer glow */}
                <circle cx={dot.x} cy={dot.y} r={16} fill={`${dot.color}25`} />
                {/* Drop shadow */}
                <circle
                  cx={dot.x}
                  cy={dot.y + 1.5}
                  r={10}
                  fill="rgba(0,0,0,0.55)"
                />
                {/* Car dot */}
                <circle
                  cx={dot.x}
                  cy={dot.y}
                  r={10}
                  fill={dot.color}
                  stroke="#ffffff"
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
                  style={{ textShadow: "0 1px 2px rgba(0,0,0,0.9)" }}
                >
                  {dot.acronym}
                </text>
              </g>
            ))}
          </svg>
        </div>
      )}
    </PanelWrapper>
  );
}
