"use client";

import { useState, useMemo } from "react";
import { PanelWrapper } from "@/components/layout/PanelWrapper";
import { DriverTag } from "@/components/shared/DriverTag";
import { useDrivers, useLaps } from "@/hooks/useF1Data";
import { formatLapTime } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

interface DriverComparisonProps {
  sessionKey: string | null;
  isLive: boolean;
  refetchInterval: number | false;
}

interface DriverStats {
  bestLap: number | null;
  avgLap: number | null;
  bestS1: number | null;
  bestS2: number | null;
  bestS3: number | null;
  topSpeed: number | null;
  lapCount: number;
}

function computeStats(
  laps: {
    lap_duration: number | null;
    duration_sector_1: number | null;
    duration_sector_2: number | null;
    duration_sector_3: number | null;
    st_speed: number | null;
    is_pit_out_lap: boolean;
  }[],
): DriverStats {
  const validLaps = laps.filter(
    (l) => l.lap_duration && !l.is_pit_out_lap && Number(l.lap_duration) < 200,
  );
  if (validLaps.length === 0)
    return {
      bestLap: null,
      avgLap: null,
      bestS1: null,
      bestS2: null,
      bestS3: null,
      topSpeed: null,
      lapCount: 0,
    };

  const times = validLaps.map((l) => Number(l.lap_duration));
  const s1 = validLaps
    .map((l) =>
      l.duration_sector_1 != null ? Number(l.duration_sector_1) : null,
    )
    .filter((v): v is number => v !== null && !isNaN(v));
  const s2 = validLaps
    .map((l) =>
      l.duration_sector_2 != null ? Number(l.duration_sector_2) : null,
    )
    .filter((v): v is number => v !== null && !isNaN(v));
  const s3 = validLaps
    .map((l) =>
      l.duration_sector_3 != null ? Number(l.duration_sector_3) : null,
    )
    .filter((v): v is number => v !== null && !isNaN(v));
  const speeds = validLaps
    .map((l) => (l.st_speed != null ? Number(l.st_speed) : null))
    .filter((v): v is number => v !== null && !isNaN(v));

  return {
    bestLap: Math.min(...times),
    avgLap: times.reduce((a, b) => a + b, 0) / times.length,
    bestS1: s1.length > 0 ? Math.min(...s1) : null,
    bestS2: s2.length > 0 ? Math.min(...s2) : null,
    bestS3: s3.length > 0 ? Math.min(...s3) : null,
    topSpeed: speeds.length > 0 ? Math.max(...speeds) : null,
    lapCount: validLaps.length,
  };
}

function DeltaCell({
  a,
  b,
  lowerIsBetter = true,
}: {
  a: number | null;
  b: number | null;
  lowerIsBetter?: boolean;
}) {
  if (a === null || b === null) return <span className="text-white/15">—</span>;
  const delta = a - b;
  const isBetter = lowerIsBetter ? delta < 0 : delta > 0;
  const color =
    Math.abs(delta) < 0.001
      ? "text-white/30"
      : isBetter
        ? "text-sector-green"
        : "text-red-flag";
  return (
    <span className={`font-mono text-[10px] ${color}`}>
      {delta > 0 ? "+" : ""}
      {Number(delta).toFixed(3)}
    </span>
  );
}

export function DriverComparison({
  sessionKey,
  isLive,
  refetchInterval,
}: DriverComparisonProps) {
  const { data: drivers } = useDrivers(sessionKey);
  const { data: allLaps } = useLaps(sessionKey, undefined, refetchInterval);
  const [driverA, setDriverA] = useState<number | null>(null);
  const [driverB, setDriverB] = useState<number | null>(null);

  const statsA = useMemo(() => {
    if (!allLaps || !driverA) return null;
    return computeStats(allLaps.filter((l) => l.driver_number === driverA));
  }, [allLaps, driverA]);

  const statsB = useMemo(() => {
    if (!allLaps || !driverB) return null;
    return computeStats(allLaps.filter((l) => l.driver_number === driverB));
  }, [allLaps, driverB]);

  const driverAData = drivers?.find((d) => d.driver_number === driverA);
  const driverBData = drivers?.find((d) => d.driver_number === driverB);

  if (!sessionKey) {
    return (
      <PanelWrapper title="Compare" isLive={isLive}>
        <p className="text-white/20 text-xs">Select a session</p>
      </PanelWrapper>
    );
  }

  const rows: {
    label: string;
    valA: number | null;
    valB: number | null;
    format: (v: number | null) => string;
    lowerIsBetter: boolean;
  }[] = [
    {
      label: "Best Lap",
      valA: statsA?.bestLap ?? null,
      valB: statsB?.bestLap ?? null,
      format: formatLapTime,
      lowerIsBetter: true,
    },
    {
      label: "Avg Lap",
      valA: statsA?.avgLap ?? null,
      valB: statsB?.avgLap ?? null,
      format: formatLapTime,
      lowerIsBetter: true,
    },
    {
      label: "Best S1",
      valA: statsA?.bestS1 ?? null,
      valB: statsB?.bestS1 ?? null,
      format: formatLapTime,
      lowerIsBetter: true,
    },
    {
      label: "Best S2",
      valA: statsA?.bestS2 ?? null,
      valB: statsB?.bestS2 ?? null,
      format: formatLapTime,
      lowerIsBetter: true,
    },
    {
      label: "Best S3",
      valA: statsA?.bestS3 ?? null,
      valB: statsB?.bestS3 ?? null,
      format: formatLapTime,
      lowerIsBetter: true,
    },
    {
      label: "Top Speed",
      valA: statsA?.topSpeed ?? null,
      valB: statsB?.topSpeed ?? null,
      format: (v) => (v !== null ? `${Number(v).toFixed(0)} km/h` : "—"),
      lowerIsBetter: false,
    },
    {
      label: "Laps",
      valA: statsA?.lapCount ?? null,
      valB: statsB?.lapCount ?? null,
      format: (v) => (v !== null ? String(v) : "—"),
      lowerIsBetter: false,
    },
  ];

  return (
    <PanelWrapper title="Compare" isLive={isLive}>
      {/* Driver selectors */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {[
          { value: driverA, setter: setDriverA, label: "Driver A" },
          { value: driverB, setter: setDriverB, label: "Driver B" },
        ].map(({ value, setter, label }) => (
          <div key={label} className="relative">
            <select
              value={value ?? ""}
              onChange={(e) =>
                setter(e.target.value ? Number(e.target.value) : null)
              }
              className="appearance-none w-full bg-white/[0.06] border border-white/[0.08] rounded-sm px-3 py-1.5 pr-7 text-xs text-white focus:outline-none focus:border-accent/50 cursor-pointer"
            >
              <option value="" className="bg-bg-panel">
                {label}
              </option>
              {drivers?.map((d) => (
                <option
                  key={d.driver_number}
                  value={d.driver_number}
                  className="bg-bg-panel"
                >
                  {d.name_acronym} — {d.team_name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 pointer-events-none" />
          </div>
        ))}
      </div>

      {/* Comparison table */}
      {driverA && driverB ? (
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-white/30 text-[10px] uppercase tracking-wider border-b border-white/[0.08]">
              <th className="text-left py-1.5">
                {driverAData && (
                  <DriverTag
                    acronym={driverAData.name_acronym}
                    teamColour={driverAData.team_colour}
                  />
                )}
              </th>
              <th className="text-center py-1.5 text-white/20">vs</th>
              <th className="text-right py-1.5">
                {driverBData && (
                  <DriverTag
                    acronym={driverBData.name_acronym}
                    teamColour={driverBData.team_colour}
                  />
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.label}
                className="border-b border-white/[0.03]"
                style={{
                  backgroundColor:
                    i % 2 === 1 ? "rgba(255,255,255,0.015)" : "transparent",
                }}
              >
                <td className="py-1.5 font-mono text-white/70">
                  {row.format(row.valA)}
                  <span className="ml-1.5">
                    <DeltaCell
                      a={row.valA}
                      b={row.valB}
                      lowerIsBetter={row.lowerIsBetter}
                    />
                  </span>
                </td>
                <td className="py-1.5 text-center text-[10px] text-white/30">
                  {row.label}
                </td>
                <td className="py-1.5 text-right font-mono text-white/70">
                  <span className="mr-1.5">
                    <DeltaCell
                      a={row.valB}
                      b={row.valA}
                      lowerIsBetter={row.lowerIsBetter}
                    />
                  </span>
                  {row.format(row.valB)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-white/20 text-[10px] text-center py-6">
          Select two drivers to compare
        </p>
      )}
    </PanelWrapper>
  );
}
