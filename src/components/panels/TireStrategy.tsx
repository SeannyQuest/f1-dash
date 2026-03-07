"use client";

import { useMemo } from "react";
import { PanelWrapper } from "@/components/layout/PanelWrapper";
import { TireIcon } from "@/components/shared/TireIcon";
import { DriverTag } from "@/components/shared/DriverTag";
import { useStints, useDrivers, usePositions } from "@/hooks/useOpenF1";
import { TIRE_COLORS } from "@/lib/constants";

interface TireStrategyProps {
  sessionKey: string | null;
  isLive: boolean;
  refetchInterval: number | false;
}

export function TireStrategy({ sessionKey, isLive, refetchInterval }: TireStrategyProps) {
  const { data: stints } = useStints(sessionKey, refetchInterval);
  const { data: drivers } = useDrivers(sessionKey);
  const { data: positions } = usePositions(sessionKey);

  const strategyRows = useMemo(() => {
    if (!stints || !drivers) return [];

    // Get latest position for each driver
    const latestPositions = new Map<number, number>();
    positions?.forEach((p) => {
      latestPositions.set(p.driver_number, p.position);
    });

    // Group stints by driver
    const byDriver = new Map<number, typeof stints>();
    stints.forEach((s) => {
      const arr = byDriver.get(s.driver_number) ?? [];
      arr.push(s);
      byDriver.set(s.driver_number, arr);
    });

    // Find max lap for scale
    let maxLap = 0;
    stints.forEach((s) => {
      if (s.lap_end > maxLap) maxLap = s.lap_end;
    });

    const driverMap = new Map(drivers.map((d) => [d.driver_number, d]));

    return Array.from(byDriver.entries())
      .map(([driverNum, driverStints]) => ({
        driver: driverMap.get(driverNum),
        stints: driverStints.sort((a, b) => a.stint_number - b.stint_number),
        position: latestPositions.get(driverNum) ?? 99,
        maxLap,
      }))
      .filter((r) => r.driver)
      .sort((a, b) => a.position - b.position);
  }, [stints, drivers, positions]);

  if (!sessionKey) {
    return (
      <PanelWrapper title="Tire Strategy" isLive={isLive}>
        <p className="text-white/30 text-sm">Select a session</p>
      </PanelWrapper>
    );
  }

  return (
    <PanelWrapper title="Tire Strategy" isLive={isLive}>
      <div className="space-y-1.5">
        {strategyRows.length === 0 && (
          <p className="text-white/30 text-sm text-center py-4">Loading stint data...</p>
        )}
        {strategyRows.map((row) => (
          <div key={row.driver!.driver_number} className="flex items-center gap-3">
            <div className="w-16 shrink-0">
              <DriverTag acronym={row.driver!.name_acronym} teamColour={row.driver!.team_colour} />
            </div>
            <div className="flex-1 flex h-7 gap-px rounded overflow-hidden">
              {row.stints.map((stint) => {
                const width = row.maxLap > 0
                  ? ((stint.lap_end - stint.lap_start + 1) / row.maxLap) * 100
                  : 0;
                const color = TIRE_COLORS[stint.compound] ?? TIRE_COLORS.UNKNOWN;
                return (
                  <div
                    key={stint.stint_number}
                    className="flex items-center justify-center text-[10px] font-mono font-bold transition-all"
                    style={{
                      width: `${width}%`,
                      backgroundColor: `${color}33`,
                      borderBottom: `2px solid ${color}`,
                      color: stint.compound === "HARD" ? "rgba(255,255,255,0.7)" : color,
                    }}
                    title={`${stint.compound} | Laps ${stint.lap_start}-${stint.lap_end} (${stint.lap_end - stint.lap_start + 1} laps)`}
                  >
                    {stint.lap_end - stint.lap_start + 1 > 3 && (
                      <span className="flex items-center gap-1">
                        <TireIcon compound={stint.compound} size="sm" />
                        <span>{stint.lap_end - stint.lap_start + 1}</span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </PanelWrapper>
  );
}
