"use client";

import { useMemo } from "react";
import { PanelWrapper } from "@/components/layout/PanelWrapper";
import { useDrivers, usePositions } from "@/hooks/useOpenF1";

interface TrackMapProps {
  sessionKey: string | null;
  isLive: boolean;
  refetchInterval: number | false;
}

// Generic oval track path for when we don't have circuit-specific data
const GENERIC_TRACK_PATH = "M 500 100 C 800 100 900 200 900 400 C 900 600 800 700 500 700 C 200 700 100 600 100 400 C 100 200 200 100 500 100 Z";

function getPointOnPath(pathElement: SVGPathElement | null, fraction: number): { x: number; y: number } {
  if (!pathElement) return { x: 500, y: 400 };
  const length = pathElement.getTotalLength();
  const point = pathElement.getPointAtLength(fraction * length);
  return { x: point.x, y: point.y };
}

export function TrackMap({ sessionKey, isLive, refetchInterval }: TrackMapProps) {
  const { data: drivers } = useDrivers(sessionKey);
  const { data: positions } = usePositions(sessionKey, refetchInterval);

  const driverPositions = useMemo(() => {
    if (!drivers || !positions) return [];

    // Get latest position for each driver
    const latestPositions = new Map<number, number>();
    positions.forEach((p) => {
      latestPositions.set(p.driver_number, p.position);
    });

    return drivers
      .map((d) => ({
        driver: d,
        position: latestPositions.get(d.driver_number) ?? 99,
      }))
      .filter((d) => d.position < 99)
      .sort((a, b) => a.position - b.position);
  }, [drivers, positions]);

  if (!sessionKey) {
    return (
      <PanelWrapper title="Track Map" isLive={isLive}>
        <p className="text-white/30 text-sm">Select a session</p>
      </PanelWrapper>
    );
  }

  const totalDrivers = driverPositions.length || 20;

  return (
    <PanelWrapper title="Track Map" isLive={isLive}>
      <svg viewBox="0 0 1000 800" className="w-full h-auto">
        {/* Track outline */}
        <path
          id="track-path"
          d={GENERIC_TRACK_PATH}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="40"
          strokeLinecap="round"
        />
        <path
          d={GENERIC_TRACK_PATH}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="44"
          strokeLinecap="round"
        />

        {/* Car dots - positioned around the track */}
        {driverPositions.map((dp) => {
          const color = dp.driver.team_colour.startsWith("#")
            ? dp.driver.team_colour
            : `#${dp.driver.team_colour}`;
          // Distribute cars evenly around the track
          const fraction = (dp.position - 1) / totalDrivers;
          // Use a simple parametric approach for the generic oval
          const angle = fraction * 2 * Math.PI - Math.PI / 2;
          const cx = 500 + 350 * Math.cos(angle);
          const cy = 400 + 250 * Math.sin(angle);

          return (
            <g key={dp.driver.driver_number}>
              {/* Glow */}
              <circle cx={cx} cy={cy} r={18} fill={`${color}22`} />
              {/* Dot */}
              <circle cx={cx} cy={cy} r={10} fill={color} stroke="rgba(0,0,0,0.5)" strokeWidth={2} />
              {/* Label */}
              <text
                x={cx}
                y={cy + 1}
                textAnchor="middle"
                dominantBaseline="central"
                fill="white"
                fontSize="8"
                fontWeight="bold"
                fontFamily="monospace"
              >
                {dp.driver.name_acronym}
              </text>
            </g>
          );
        })}

        {/* Start/Finish line */}
        <line x1="500" y1="60" x2="500" y2="140" stroke="white" strokeWidth="3" strokeDasharray="8 4" />
        <text x="500" y="50" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="12" fontFamily="monospace">
          S/F
        </text>
      </svg>
    </PanelWrapper>
  );
}
