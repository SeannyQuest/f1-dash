"use client";

import { useMemo } from "react";
import { PanelWrapper } from "@/components/layout/PanelWrapper";
import { DriverTag } from "@/components/shared/DriverTag";
import { useDrivers, usePositions, useLaps, useIntervals } from "@/hooks/useOpenF1";
import { formatLapTime, formatGap, formatInterval } from "@/lib/utils";

interface TimingTowerProps {
  sessionKey: string | null;
  isLive: boolean;
  refetchInterval: number | false;
}

export function TimingTower({ sessionKey, isLive, refetchInterval }: TimingTowerProps) {
  const { data: drivers } = useDrivers(sessionKey, refetchInterval);
  const { data: positions } = usePositions(sessionKey, refetchInterval);
  const { data: laps } = useLaps(sessionKey, undefined, refetchInterval);
  const { data: intervals } = useIntervals(sessionKey, refetchInterval);

  const standings = useMemo(() => {
    if (!drivers || !positions) return [];

    // Get the latest position for each driver
    const latestPositions = new Map<number, number>();
    positions.forEach((p) => {
      latestPositions.set(p.driver_number, p.position);
    });

    // Get the latest interval for each driver
    const latestIntervals = new Map<number, { gap: number | null; interval: number | null }>();
    intervals?.forEach((i) => {
      latestIntervals.set(i.driver_number, { gap: i.gap_to_leader, interval: i.interval });
    });

    // Get best and last lap for each driver
    const driverLaps = new Map<number, { best: number | null; last: number | null }>();
    laps?.forEach((l) => {
      if (l.lap_duration === null) return;
      const existing = driverLaps.get(l.driver_number);
      const best = existing?.best ? Math.min(existing.best, l.lap_duration) : l.lap_duration;
      driverLaps.set(l.driver_number, { best, last: l.lap_duration });
    });

    // Find overall best lap
    let overallBest = Infinity;
    driverLaps.forEach((d) => {
      if (d.best !== null && d.best < overallBest) overallBest = d.best;
    });

    return drivers
      .map((driver) => ({
        driver,
        position: latestPositions.get(driver.driver_number) ?? 99,
        gap: latestIntervals.get(driver.driver_number)?.gap ?? null,
        interval: latestIntervals.get(driver.driver_number)?.interval ?? null,
        bestLap: driverLaps.get(driver.driver_number)?.best ?? null,
        lastLap: driverLaps.get(driver.driver_number)?.last ?? null,
        isOverallBest:
          driverLaps.get(driver.driver_number)?.best === overallBest && overallBest < Infinity,
      }))
      .sort((a, b) => a.position - b.position);
  }, [drivers, positions, laps, intervals]);

  if (!sessionKey) {
    return (
      <PanelWrapper title="Timing Tower" isLive={isLive}>
        <p className="text-white/30 text-sm">Select a session to view timing data</p>
      </PanelWrapper>
    );
  }

  return (
    <PanelWrapper title="Timing Tower" isLive={isLive} className="min-h-[500px]">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-white/40 text-xs uppercase tracking-wider border-b border-white/[0.06]">
              <th className="text-left py-2 pr-2 w-8">P</th>
              <th className="text-left py-2 pr-3">Driver</th>
              <th className="text-right py-2 pr-3">Gap</th>
              <th className="text-right py-2 pr-3">Int</th>
              <th className="text-right py-2 pr-3">Last</th>
              <th className="text-right py-2">Best</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row) => (
              <tr
                key={row.driver.driver_number}
                className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
              >
                <td className="py-2 pr-2 font-mono font-bold text-white/60">{row.position}</td>
                <td className="py-2 pr-3">
                  <DriverTag acronym={row.driver.name_acronym} teamColour={row.driver.team_colour} />
                </td>
                <td className="py-2 pr-3 text-right font-mono text-white/70">
                  {formatGap(row.gap)}
                </td>
                <td className="py-2 pr-3 text-right font-mono text-white/70">
                  {formatInterval(row.interval)}
                </td>
                <td className="py-2 pr-3 text-right font-mono text-white/80">
                  {formatLapTime(row.lastLap)}
                </td>
                <td
                  className={`py-2 text-right font-mono font-semibold ${
                    row.isOverallBest ? "text-purple-sector" : "text-green-flag"
                  }`}
                >
                  {formatLapTime(row.bestLap)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {standings.length === 0 && (
          <p className="text-white/30 text-sm text-center py-8">Loading timing data...</p>
        )}
      </div>
    </PanelWrapper>
  );
}
