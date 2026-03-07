"use client";

import { useEffect, useMemo, useState } from "react";
import { PanelWrapper } from "@/components/layout/PanelWrapper";
import { useDrivers } from "@/hooks/useOpenF1";
import { useWebSocket } from "@/hooks/useWebSocket";

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
  const { locations, connected } = useWebSocket(sessionKey);
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

  if (!sessionKey) {
    return (
      <PanelWrapper title="Track Map" isLive={isLive}>
        <p className="text-white/30 text-sm">Select a session</p>
      </PanelWrapper>
    );
  }

  return (
    <PanelWrapper title="Track Map" isLive={isLive}>
      {/* Connection status */}
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`w-2 h-2 rounded-full ${
            connected ? "bg-green-400 animate-pulse" : "bg-red-400"
          }`}
        />
        <span className="text-[10px] text-white/40 uppercase tracking-wider">
          {connected ? "Live" : "Connecting..."}
        </span>
        {locations.length > 0 && (
          <span className="text-[10px] text-white/30 ml-auto">
            {locations.length} cars
          </span>
        )}
      </div>

      {circuitLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="text-white/30 text-sm">Loading circuit...</div>
        </div>
      ) : !circuit ? (
        <div className="flex items-center justify-center h-48">
          <div className="text-white/30 text-sm">No circuit data available</div>
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
          className="w-full h-auto"
        >
          {/* Track surface glow */}
          <path
            d={trackPath}
            fill="none"
            stroke="rgba(255,255,255,0.03)"
            strokeWidth="28"
            strokeLinejoin="round"
          />
          {/* Track outline */}
          <path
            d={trackPath}
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="18"
            strokeLinejoin="round"
          />
          {/* Track center line */}
          <path
            d={trackPath}
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />

          {/* Corner numbers */}
          {corners.map((c) => (
            <g key={`corner-${c.number}`}>
              <circle cx={c.x} cy={c.y} r={8} fill="rgba(255,255,255,0.06)" />
              <text
                x={c.x}
                y={c.y + 1}
                textAnchor="middle"
                dominantBaseline="central"
                fill="rgba(255,255,255,0.25)"
                fontSize="7"
                fontFamily="monospace"
              >
                {c.number}
              </text>
            </g>
          ))}

          {/* Driver dots */}
          {driverDots.map((dot) => (
            <g key={dot.key}>
              {/* Outer glow */}
              <circle cx={dot.x} cy={dot.y} r={16} fill={`${dot.color}18`} />
              {/* Car dot */}
              <circle
                cx={dot.x}
                cy={dot.y}
                r={9}
                fill={dot.color}
                stroke="rgba(0,0,0,0.6)"
                strokeWidth={1.5}
              />
              {/* Driver abbreviation */}
              <text
                x={dot.x}
                y={dot.y + 0.5}
                textAnchor="middle"
                dominantBaseline="central"
                fill="white"
                fontSize="6.5"
                fontWeight="bold"
                fontFamily="monospace"
              >
                {dot.acronym}
              </text>
            </g>
          ))}

          {/* Start/Finish marker — first point on circuit */}
          {circuit.x.length > 0 &&
            bounds &&
            (() => {
              const sf = transformPoint(circuit.x[0], circuit.y[0], bounds);
              return (
                <g>
                  <rect
                    x={sf.x - 12}
                    y={sf.y - 16}
                    width={24}
                    height={10}
                    rx={2}
                    fill="rgba(255,255,255,0.1)"
                  />
                  <text
                    x={sf.x}
                    y={sf.y - 10}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="rgba(255,255,255,0.4)"
                    fontSize="6"
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
