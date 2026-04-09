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
  /** Display rotation in degrees (counter-clockwise). Applied to the polyline
   * AND live driver positions before computing screen coordinates. */
  rotation: number;
  marshalSectors?: Array<{
    number: number;
    x: number;
    y: number;
    angle: number;
  }>;
  marshalLights?: Array<{
    number: number;
    x: number;
    y: number;
    angle: number;
  }>;
}

/** Rotate a point (x, y) by `angleDeg` around the origin (CCW). */
function rotatePoint(
  x: number,
  y: number,
  angleDeg: number,
): { x: number; y: number } {
  if (angleDeg === 0) return { x, y };
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  };
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

const TRACK_COLORS = {
  asphalt: "#3a3a40",
  kerbWhite: "#ffffff",
  kerbRed: "#e10600",
  gravel: "#8a7a5a",
  grass: "#1a4a26",
  grassAlt: "#1d5229",
  edgeLine: "rgba(255,255,255,0.25)",
  sectorS1: "#e10600",
  sectorS2: "#0090ff",
  sectorS3: "#ffd000",
  marshalPost: "#ffd000",
  pitLane: "#3a3a40",
  pitDash: "rgba(255,255,255,0.2)",
};

const TRACK_WIDTHS = {
  grass: 40,
  gravel: 32,
  kerb: 22,
  surface: 16,
  edgeLine: 17,
  pitLane: 5,
};

function computeBounds(x: number[], y: number[]): Bounds {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (let i = 0; i < x.length; i++) {
    if (x[i] < minX) minX = x[i];
    if (x[i] > maxX) maxX = x[i];
    if (y[i] < minY) minY = y[i];
    if (y[i] > maxY) maxY = y[i];
  }
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
    y: VIEW_SIZE - ((py - bounds.minY) * scale + offsetY),
  };
}

/**
 * Derive a pit lane path from the track polyline by finding the longest
 * straight segment and offsetting it inward.
 */
function derivePitLane(
  screenPoints: Array<{ x: number; y: number }>,
): { path: string; labelX: number; labelY: number } | null {
  if (screenPoints.length < 20) return null;

  const angles: number[] = [];
  for (let i = 0; i < screenPoints.length - 1; i++) {
    const dx = screenPoints[i + 1].x - screenPoints[i].x;
    const dy = screenPoints[i + 1].y - screenPoints[i].y;
    angles.push(Math.atan2(dy, dx));
  }

  const MAX_ANGLE_CHANGE = 0.3;
  const MIN_STRAIGHT_POINTS = 15;
  let bestStart = 0;
  let bestLen = 0;

  for (let start = 0; start < angles.length; start++) {
    let totalAngleChange = 0;
    let len = 0;
    for (let j = start; j < angles.length - 1; j++) {
      let delta = angles[j + 1] - angles[j];
      while (delta > Math.PI) delta -= 2 * Math.PI;
      while (delta < -Math.PI) delta += 2 * Math.PI;
      totalAngleChange += Math.abs(delta);
      if (totalAngleChange > MAX_ANGLE_CHANGE) break;
      len = j - start + 2;
    }
    if (len > bestLen) {
      bestLen = len;
      bestStart = start;
    }
  }

  if (bestLen < MIN_STRAIGHT_POINTS) return null;

  const OFFSET = 25;
  const midIdx = bestStart + Math.floor(bestLen / 2);
  const dx =
    screenPoints[bestStart + bestLen - 1].x - screenPoints[bestStart].x;
  const dy =
    screenPoints[bestStart + bestLen - 1].y - screenPoints[bestStart].y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return null;

  const perpX = -dy / len;
  const perpY = dx / len;

  const step = Math.max(1, Math.floor(bestLen / 20));
  const pitPoints: string[] = [];
  for (let i = bestStart; i < bestStart + bestLen; i += step) {
    const px = screenPoints[i].x + perpX * OFFSET;
    const py = screenPoints[i].y + perpY * OFFSET;
    pitPoints.push(`${px.toFixed(1)},${py.toFixed(1)}`);
  }
  const last = screenPoints[bestStart + bestLen - 1];
  pitPoints.push(
    `${(last.x + perpX * OFFSET).toFixed(1)},${(last.y + perpY * OFFSET).toFixed(1)}`,
  );

  const labelPt = screenPoints[midIdx];
  return {
    path: `M ${pitPoints.join(" L ")}`,
    labelX: labelPt.x + perpX * (OFFSET + 10),
    labelY: labelPt.y + perpY * (OFFSET + 10),
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

  // Pre-rotate the track polyline once per circuit load using the broadcast
  // rotation angle supplied by MultiViewer. Bounds are computed on the
  // rotated polyline so everything (track, corners, dots) lives in the same
  // display-oriented coordinate space.
  const rotation = circuit?.rotation ?? 0;
  const rotatedTrack = useMemo(() => {
    if (!circuit) return null;
    const rx: number[] = new Array(circuit.x.length);
    const ry: number[] = new Array(circuit.y.length);
    for (let i = 0; i < circuit.x.length; i++) {
      const p = rotatePoint(circuit.x[i], circuit.y[i], rotation);
      rx[i] = p.x;
      ry[i] = p.y;
    }
    return { x: rx, y: ry };
  }, [circuit, rotation]);

  const bounds = useMemo(() => {
    if (!rotatedTrack) return null;
    return computeBounds(rotatedTrack.x, rotatedTrack.y);
  }, [rotatedTrack]);

  // Pre-compute screen-space points from rotated polyline (used by trackPath + pitLane).
  const screenPoints = useMemo(() => {
    if (!rotatedTrack || !bounds) return [];
    return rotatedTrack.x.map((x, i) =>
      transformPoint(x, rotatedTrack.y[i], bounds),
    );
  }, [rotatedTrack, bounds]);

  // Build the track outline path
  const trackPath = useMemo(() => {
    if (screenPoints.length === 0) return "";
    const points = screenPoints.map(
      (p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`,
    );
    return `M ${points.join(" L ")} Z`;
  }, [screenPoints]);

  // Map driver locations to screen positions — rotate by the same angle so
  // dots stay aligned with the track.
  const driverDots = useMemo(() => {
    if (!bounds || !drivers) return [];
    const driverMap = new Map(drivers.map((d) => [d.driver_number, d]));

    return locations
      .filter((loc) => driverMap.has(loc.driver_number))
      .map((loc) => {
        const driver = driverMap.get(loc.driver_number)!;
        const rotated = rotatePoint(loc.x, loc.y, rotation);
        const pos = transformPoint(rotated.x, rotated.y, bounds);
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
  }, [locations, bounds, drivers, rotation]);

  // Transform corner positions through the same rotation pipeline.
  const corners = useMemo(() => {
    if (!circuit?.corners || !bounds) return [];
    return circuit.corners.map((c) => {
      const rotated = rotatePoint(c.x, c.y, rotation);
      const pos = transformPoint(rotated.x, rotated.y, bounds);
      return { number: c.number, x: pos.x, y: pos.y };
    });
  }, [circuit, bounds, rotation]);

  // Transform marshal light positions through the same rotation pipeline.
  const marshalLightPositions = useMemo(() => {
    if (!circuit?.marshalLights || !bounds) return [];
    return circuit.marshalLights.map((m) => {
      const rotated = rotatePoint(m.x, m.y, rotation);
      const pos = transformPoint(rotated.x, rotated.y, bounds);
      return { number: m.number, x: pos.x, y: pos.y };
    });
  }, [circuit, bounds, rotation]);

  // Derive sector boundary positions from marshalSectors (split into thirds for S1/S2/S3).
  const sectorBoundaries = useMemo(() => {
    if (
      !circuit?.marshalSectors ||
      circuit.marshalSectors.length < 6 ||
      !bounds
    )
      return [];
    const sectors = circuit.marshalSectors;
    const s1Idx = Math.round(sectors.length / 3);
    const s2Idx = Math.round((sectors.length * 2) / 3);
    const s1 = sectors[s1Idx];
    const s2 = sectors[s2Idx];
    if (!s1 || !s2) return [];

    const r1 = rotatePoint(s1.x, s1.y, rotation);
    const p1 = transformPoint(r1.x, r1.y, bounds);
    const r2 = rotatePoint(s2.x, s2.y, rotation);
    const p2 = transformPoint(r2.x, r2.y, bounds);

    return [
      { label: "S1", color: TRACK_COLORS.sectorS1, x: p1.x, y: p1.y },
      { label: "S2", color: TRACK_COLORS.sectorS2, x: p2.x, y: p2.y },
    ];
  }, [circuit, bounds, rotation]);

  // Derive pit lane from the shared screen-space points.
  const pitLane = useMemo(() => {
    if (screenPoints.length === 0) return null;
    return derivePitLane(screenPoints);
  }, [screenPoints]);

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
            <defs>
              <pattern
                id="grass-pattern"
                width="6"
                height="6"
                patternUnits="userSpaceOnUse"
              >
                <rect width="6" height="6" fill={TRACK_COLORS.grass} />
                <rect
                  x="0"
                  y="0"
                  width="2"
                  height="2"
                  fill={TRACK_COLORS.grassAlt}
                  opacity="0.5"
                />
                <rect
                  x="3"
                  y="3"
                  width="2"
                  height="2"
                  fill="#174520"
                  opacity="0.5"
                />
              </pattern>
              <pattern
                id="gravel-pattern"
                width="4"
                height="4"
                patternUnits="userSpaceOnUse"
              >
                <rect width="4" height="4" fill={TRACK_COLORS.gravel} />
                <circle cx="1" cy="1" r="0.8" fill="#9a8a6a" opacity="0.4" />
                <circle cx="3" cy="3" r="0.6" fill="#7a6a4a" opacity="0.4" />
              </pattern>
            </defs>

            {/* Layer 1: Grass infield + surrounding area */}
            <path
              d={trackPath}
              fill="url(#grass-pattern)"
              fillOpacity="0.5"
              stroke="none"
            />

            {/* Layer 2: Gravel run-off (wide outer band) */}
            <path
              d={trackPath}
              fill="none"
              stroke="url(#gravel-pattern)"
              strokeWidth={TRACK_WIDTHS.gravel}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity="0.35"
            />

            {/* Layer 3a: Kerb base (white) */}
            <path
              d={trackPath}
              fill="none"
              stroke={TRACK_COLORS.kerbWhite}
              strokeWidth={TRACK_WIDTHS.kerb}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity="0.95"
            />
            {/* Layer 3b: Kerb red dashes */}
            <path
              d={trackPath}
              fill="none"
              stroke={TRACK_COLORS.kerbRed}
              strokeWidth={TRACK_WIDTHS.kerb}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity="0.5"
              strokeDasharray="6 8"
            />

            {/* Layer 4a: Track edge lines (white border effect) */}
            <path
              d={trackPath}
              fill="none"
              stroke={TRACK_COLORS.edgeLine}
              strokeWidth={TRACK_WIDTHS.edgeLine}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {/* Layer 4b: Track surface (grey asphalt) */}
            <path
              d={trackPath}
              fill="none"
              stroke={TRACK_COLORS.asphalt}
              strokeWidth={TRACK_WIDTHS.surface}
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* Layer 5: Sector boundaries */}
            {sectorBoundaries.map((s) => (
              <g key={s.label}>
                <line
                  x1={s.x}
                  y1={s.y - 18}
                  x2={s.x}
                  y2={s.y + 18}
                  stroke={s.color}
                  strokeWidth="2.5"
                  opacity="0.8"
                />
                <text
                  x={s.x}
                  y={s.y - 22}
                  textAnchor="middle"
                  fill={s.color}
                  fontSize="7"
                  fontFamily="monospace"
                  fontWeight="bold"
                  opacity="0.7"
                >
                  {s.label}
                </text>
              </g>
            ))}

            {/* Layer 6: Marshal post markers */}
            {marshalLightPositions.map((m) => (
              <circle
                key={`marshal-${m.number}`}
                cx={m.x}
                cy={m.y}
                r={3}
                fill={TRACK_COLORS.marshalPost}
                opacity="0.5"
              />
            ))}

            {/* Layer 7: Pit lane */}
            {pitLane && (
              <g>
                <path
                  d={pitLane.path}
                  fill="none"
                  stroke={TRACK_COLORS.edgeLine}
                  strokeWidth={TRACK_WIDTHS.pitLane + 1}
                  strokeLinecap="round"
                />
                <path
                  d={pitLane.path}
                  fill="none"
                  stroke={TRACK_COLORS.pitLane}
                  strokeWidth={TRACK_WIDTHS.pitLane}
                  strokeLinecap="round"
                />
                <path
                  d={pitLane.path}
                  fill="none"
                  stroke={TRACK_COLORS.pitDash}
                  strokeWidth="1"
                  strokeDasharray="4 6"
                />
                <text
                  x={pitLane.labelX}
                  y={pitLane.labelY}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.4)"
                  fontSize="7"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  PIT
                </text>
              </g>
            )}

            {/* Layer 8: Corner numbers */}
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

            {/* Layer 9: Start/Finish checkered flag */}
            {rotatedTrack &&
              rotatedTrack.x.length > 0 &&
              bounds &&
              (() => {
                const sf = transformPoint(
                  rotatedTrack.x[0],
                  rotatedTrack.y[0],
                  bounds,
                );
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

            {/* Layer 10: Driver dots */}
            {driverDots.map((dot) => (
              <g key={dot.key}>
                <circle cx={dot.x} cy={dot.y} r={16} fill={`${dot.color}25`} />
                <circle
                  cx={dot.x}
                  cy={dot.y + 1.5}
                  r={10}
                  fill="rgba(0,0,0,0.55)"
                />
                <circle
                  cx={dot.x}
                  cy={dot.y}
                  r={10}
                  fill={dot.color}
                  stroke="#ffffff"
                  strokeWidth={1.5}
                />
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
