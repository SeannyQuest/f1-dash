"use client";

import { useState, useMemo } from "react";
import { PanelWrapper } from "@/components/layout/PanelWrapper";
import { DriverTag } from "@/components/shared/DriverTag";
import { useDrivers, useLaps } from "@/hooks/useOpenF1";
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

function computeStats(laps: { lap_duration: number | null; duration_sector_1: number | null; duration_sector_2: number | null; duration_sector_3: number | null; st_speed: number | null; is_pit_out_lap: boolean }[]): DriverStats {
  const validLaps = laps.filter((l) => l.lap_duration && !l.is_pit_out_lap && l.lap_duration < 200);
  if (validLaps.length === 0) return { bestLap: null, avgLap: null, bestS1: null, bestS2: null, bestS3: null, topSpeed: null, lapCount: 0 };

  const times = validLaps.map((l) => l.lap_duration!);
  const s1 = validLaps.map((l) => l.duration_sector_1).filter((v): v is number => v !== null);
  const s2 = validLaps.map((l) => l.duration_sector_2).filter((v): v is number => v !== null);
  const s3 = validLaps.map((l) => l.duration_sector_3).filter((v): v is number => v !== null);
  const speeds = validLaps.map((l) => l.st_speed).filter((v): v is number => v !== null);

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

function DeltaCell({ a, b, lowerIsBetter = true }: { a: number | null; b: number | null; lowerIsBetter?: boolean }) {
  if (a === null || b === null) return <span className="text-white/30">—</span>;
  const delta = a - b;
  const isBetter = lowerIsBetter ? delta < 0 : delta > 0;
  const color = Math.abs(delta) < 0.001 ? "text-white/50" : isBetter ? "text-green-flag" : "text-red-flag";
  return <span className={`font-mono text-xs ${color}`}>{delta > 0 ? "+" : ""}{delta.toFixed(3)}</span>;
}

export function DriverComparison({ sessionKey, isLive, refetchInterval }: DriverComparisonProps) {
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
      <PanelWrapper title="Driver Comparison" isLive={isLive}>
        <p className="text-white/30 text-sm">Select a session</p>
      </PanelWrapper>
    );
  }

  const rows: { label: string; valA: number | null; valB: number | null; format: (v: number | null) => string; lowerIsBetter: boolean }[] = [
    { label: "Best Lap", valA: statsA?.bestLap ?? null, valB: statsB?.bestLap ?? null, format: formatLapTime, lowerIsBetter: true },
    { label: "Avg Lap", valA: statsA?.avgLap ?? null, valB: statsB?.avgLap ?? null, format: formatLapTime, lowerIsBetter: true },
    { label: "Best S1", valA: statsA?.bestS1 ?? null, valB: statsB?.bestS1 ?? null, format: formatLapTime, lowerIsBetter: true },
    { label: "Best S2", valA: statsA?.bestS2 ?? null, valB: statsB?.bestS2 ?? null, format: formatLapTime, lowerIsBetter: true },
    { label: "Best S3", valA: statsA?.bestS3 ?? null, valB: statsB?.bestS3 ?? null, format: formatLapTime, lowerIsBetter: true },
    { label: "Top Speed", valA: statsA?.topSpeed ?? null, valB: statsB?.topSpeed ?? null, format: (v) => v !== null ? `${v.toFixed(0)} km/h` : "—", lowerIsBetter: false },
    { label: "Laps", valA: statsA?.lapCount ?? null, valB: statsB?.lapCount ?? null, format: (v) => v !== null ? String(v) : "—", lowerIsBetter: false },
  ];

  return (
    <PanelWrapper title="Driver Comparison" isLive={isLive}>
      {/* Driver selectors */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {[{ value: driverA, setter: setDriverA, label: "Driver A" }, { value: driverB, setter: setDriverB, label: "Driver B" }].map(
          ({ value, setter, label }) => (
            <div key={label} className="relative">
              <select
                value={value ?? ""}
                onChange={(e) => setter(e.target.value ? Number(e.target.value) : null)}
                className="appearance-none w-full bg-white/[0.06] border border-white/[0.1] rounded-lg px-3 py-2 pr-8 text-sm text-white focus:outline-none focus:border-cyan-primary/50 cursor-pointer"
              >
                <option value="" className="bg-obsidian-light">{label}</option>
                {drivers?.map((d) => (
                  <option key={d.driver_number} value={d.driver_number} className="bg-obsidian-light">
                    {d.name_acronym} — {d.team_name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
            </div>
          )
        )}
      </div>

      {/* Comparison table */}
      {driverA && driverB ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-white/40 text-xs uppercase tracking-wider border-b border-white/[0.06]">
              <th className="text-left py-2">
                {driverAData && <DriverTag acronym={driverAData.name_acronym} teamColour={driverAData.team_colour} />}
              </th>
              <th className="text-center py-2">Metric</th>
              <th className="text-right py-2">
                {driverBData && <DriverTag acronym={driverBData.name_acronym} teamColour={driverBData.team_colour} />}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-white/[0.03]">
                <td className="py-2 font-mono text-white/80">
                  {row.format(row.valA)}
                  <span className="ml-2">
                    <DeltaCell a={row.valA} b={row.valB} lowerIsBetter={row.lowerIsBetter} />
                  </span>
                </td>
                <td className="py-2 text-center text-xs text-white/50">{row.label}</td>
                <td className="py-2 text-right font-mono text-white/80">
                  <span className="mr-2">
                    <DeltaCell a={row.valB} b={row.valA} lowerIsBetter={row.lowerIsBetter} />
                  </span>
                  {row.format(row.valB)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-white/30 text-sm text-center py-8">Select two drivers to compare</p>
      )}
    </PanelWrapper>
  );
}
