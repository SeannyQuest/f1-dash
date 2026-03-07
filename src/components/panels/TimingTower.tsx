"use client";

import { useMemo } from "react";
import { PanelWrapper } from "@/components/layout/PanelWrapper";
import { TireIcon } from "@/components/shared/TireIcon";
import { SectorMiniBar } from "@/components/shared/SectorMiniBar";
import {
  useDrivers,
  usePositions,
  useLaps,
  useIntervals,
  useStints,
} from "@/hooks/useF1Data";
import {
  formatLapTime,
  formatGap,
  formatInterval,
  classifySectorTime,
} from "@/lib/utils";

interface TimingTowerProps {
  sessionKey: string | null;
  isLive: boolean;
  refetchInterval: number | false;
}

const POSITION_STYLES: Record<
  number,
  { bg: string; badge: string; glow: string }
> = {
  1: {
    bg: "rgba(255, 215, 0, 0.08)",
    badge: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
    glow: "0 0 12px rgba(255, 215, 0, 0.3)",
  },
  2: {
    bg: "rgba(192, 192, 192, 0.06)",
    badge: "linear-gradient(135deg, #C0C0C0 0%, #A0A0A0 100%)",
    glow: "0 0 8px rgba(192, 192, 192, 0.2)",
  },
  3: {
    bg: "rgba(205, 127, 50, 0.06)",
    badge: "linear-gradient(135deg, #CD7F32 0%, #A0622E 100%)",
    glow: "0 0 8px rgba(205, 127, 50, 0.2)",
  },
};

export function TimingTower({
  sessionKey,
  isLive,
  refetchInterval,
}: TimingTowerProps) {
  const { data: drivers } = useDrivers(sessionKey, refetchInterval);
  const { data: positions } = usePositions(sessionKey, refetchInterval);
  const { data: laps } = useLaps(sessionKey, undefined, refetchInterval);
  const { data: intervals } = useIntervals(sessionKey, refetchInterval);
  const { data: stints } = useStints(sessionKey, refetchInterval);

  const standings = useMemo(() => {
    if (!drivers || !positions) return [];

    const latestPositions = new Map<number, number>();
    positions.forEach((p) => {
      latestPositions.set(p.driver_number, p.position);
    });

    const latestIntervals = new Map<
      number,
      { gap: number | null; interval: number | null }
    >();
    intervals?.forEach((i) => {
      latestIntervals.set(i.driver_number, {
        gap: i.gap_to_leader,
        interval: i.interval,
      });
    });

    const driverLaps = new Map<
      number,
      {
        best: number | null;
        last: number | null;
        bestS1: number | null;
        bestS2: number | null;
        bestS3: number | null;
        lastS1: number | null;
        lastS2: number | null;
        lastS3: number | null;
      }
    >();
    laps?.forEach((l) => {
      if (l.lap_duration === null) return;
      const existing = driverLaps.get(l.driver_number);
      const best = existing?.best
        ? Math.min(existing.best, l.lap_duration)
        : l.lap_duration;
      const s1 =
        l.duration_sector_1 != null ? Number(l.duration_sector_1) : null;
      const s2 =
        l.duration_sector_2 != null ? Number(l.duration_sector_2) : null;
      const s3 =
        l.duration_sector_3 != null ? Number(l.duration_sector_3) : null;
      const bestS1 =
        s1 !== null
          ? Math.min(existing?.bestS1 ?? Infinity, s1)
          : (existing?.bestS1 ?? null);
      const bestS2 =
        s2 !== null
          ? Math.min(existing?.bestS2 ?? Infinity, s2)
          : (existing?.bestS2 ?? null);
      const bestS3 =
        s3 !== null
          ? Math.min(existing?.bestS3 ?? Infinity, s3)
          : (existing?.bestS3 ?? null);
      driverLaps.set(l.driver_number, {
        best,
        last: l.lap_duration,
        bestS1,
        bestS2,
        bestS3,
        lastS1: s1,
        lastS2: s2,
        lastS3: s3,
      });
    });

    let overallBest = Infinity;
    let overallBestS1 = Infinity;
    let overallBestS2 = Infinity;
    let overallBestS3 = Infinity;
    driverLaps.forEach((d) => {
      if (d.best !== null && d.best < overallBest) overallBest = d.best;
      if (d.bestS1 !== null && d.bestS1 < overallBestS1)
        overallBestS1 = d.bestS1;
      if (d.bestS2 !== null && d.bestS2 < overallBestS2)
        overallBestS2 = d.bestS2;
      if (d.bestS3 !== null && d.bestS3 < overallBestS3)
        overallBestS3 = d.bestS3;
    });

    const currentTire = new Map<number, string>();
    stints?.forEach((s) => {
      currentTire.set(s.driver_number, s.compound);
    });

    return drivers
      .map((driver) => {
        const dl = driverLaps.get(driver.driver_number);
        return {
          driver,
          position: latestPositions.get(driver.driver_number) ?? 99,
          gap: latestIntervals.get(driver.driver_number)?.gap ?? null,
          interval: latestIntervals.get(driver.driver_number)?.interval ?? null,
          bestLap: dl?.best ?? null,
          lastLap: dl?.last ?? null,
          isOverallBest: dl?.best === overallBest && overallBest < Infinity,
          isPersonalBest:
            dl != null &&
            dl.last !== null &&
            dl.best !== null &&
            dl.last <= dl.best,
          tire: currentTire.get(driver.driver_number) ?? null,
          s1: classifySectorTime(
            dl?.lastS1 ?? null,
            dl?.bestS1 ?? null,
            overallBestS1 < Infinity ? overallBestS1 : null,
          ),
          s2: classifySectorTime(
            dl?.lastS2 ?? null,
            dl?.bestS2 ?? null,
            overallBestS2 < Infinity ? overallBestS2 : null,
          ),
          s3: classifySectorTime(
            dl?.lastS3 ?? null,
            dl?.bestS3 ?? null,
            overallBestS3 < Infinity ? overallBestS3 : null,
          ),
        };
      })
      .sort((a, b) => a.position - b.position);
  }, [drivers, positions, laps, intervals, stints]);

  if (!sessionKey) {
    return (
      <PanelWrapper title="Timing" isLive={isLive} className="h-full">
        <p className="text-white/20 text-xs">Select a session</p>
      </PanelWrapper>
    );
  }

  return (
    <PanelWrapper title="Timing" isLive={isLive} className="h-full">
      <div className="overflow-x-auto -mx-3 -mt-1">
        <table className="w-full text-[11px]">
          <thead>
            <tr
              className="text-[10px] uppercase tracking-wider"
              style={{
                background:
                  "linear-gradient(90deg, rgba(225, 6, 0, 0.06) 0%, transparent 50%)",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            >
              <th className="text-left py-1.5 pl-3 pr-1 w-8 text-white/40 font-bold">
                P
              </th>
              <th className="text-left py-1.5 pr-1 text-white/40 font-bold">
                Driver
              </th>
              <th className="text-center py-1.5 px-1 w-12 text-white/40 font-bold">
                Sectors
              </th>
              <th className="text-right py-1.5 px-1 text-white/40 font-bold">
                Gap
              </th>
              <th className="text-right py-1.5 px-1 text-white/40 font-bold">
                Int
              </th>
              <th className="text-right py-1.5 px-1 text-white/40 font-bold">
                Last
              </th>
              <th className="text-right py-1.5 pr-3 pl-1 text-white/40 font-bold">
                Best
              </th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row, i) => {
              const teamColor = row.driver.team_colour.startsWith("#")
                ? row.driver.team_colour
                : `#${row.driver.team_colour}`;
              const posStyle = POSITION_STYLES[row.position];
              const isEvenRow = i % 2 === 1;

              let lastLapColor = "text-white/60";
              if (row.isOverallBest) lastLapColor = "text-sector-purple";
              else if (row.isPersonalBest) lastLapColor = "text-sector-green";

              return (
                <tr
                  key={row.driver.driver_number}
                  className="transition-all duration-200 hover:!bg-white/[0.04] group"
                  style={{
                    background: posStyle
                      ? posStyle.bg
                      : isEvenRow
                        ? "rgba(255,255,255,0.015)"
                        : "transparent",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.03)",
                    animation: `row-enter 0.3s ease-out ${i * 0.02}s both`,
                  }}
                >
                  {/* Position + team color bar */}
                  <td className="py-1.5 pl-0 pr-1 relative">
                    <div
                      className="absolute left-0 top-0 bottom-0 w-[4px]"
                      style={{
                        background: `linear-gradient(180deg, ${teamColor} 0%, ${teamColor}80 100%)`,
                        boxShadow: `0 0 8px ${teamColor}40`,
                      }}
                    />
                    <div
                      className="absolute left-0 top-0 bottom-0 w-16 pointer-events-none"
                      style={{
                        background: `linear-gradient(90deg, ${teamColor}12 0%, transparent 100%)`,
                      }}
                    />
                    {posStyle ? (
                      <span
                        className="relative font-mono font-black text-xs pl-2.5 inline-block w-6 text-center"
                        style={{
                          background: posStyle.badge,
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                          filter: "drop-shadow(0 0 4px rgba(255, 215, 0, 0.3))",
                        }}
                      >
                        {row.position}
                      </span>
                    ) : (
                      <span className="relative font-mono font-bold text-white/40 pl-2.5 text-xs">
                        {row.position}
                      </span>
                    )}
                  </td>

                  {/* Driver + Tire */}
                  <td className="py-1.5 pr-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-white text-xs tracking-wide">
                        {row.driver.name_acronym}
                      </span>
                      {row.tire && <TireIcon compound={row.tire} size="xs" />}
                    </div>
                  </td>

                  {/* Sector mini-bars */}
                  <td className="py-1.5 px-1 text-center">
                    <SectorMiniBar s1={row.s1} s2={row.s2} s3={row.s3} />
                  </td>

                  {/* Gap */}
                  <td className="py-1.5 px-1 text-right font-mono text-white/40 text-[10px]">
                    {formatGap(row.gap)}
                  </td>

                  {/* Interval */}
                  <td className="py-1.5 px-1 text-right font-mono text-white/40 text-[10px]">
                    {formatInterval(row.interval)}
                  </td>

                  {/* Last lap */}
                  <td
                    className={`py-1.5 px-1 text-right font-mono font-semibold text-[10px] ${lastLapColor}`}
                  >
                    {formatLapTime(row.lastLap)}
                  </td>

                  {/* Best lap */}
                  <td className="py-1.5 pr-3 pl-1 text-right font-mono font-bold text-[10px]">
                    <span
                      className={
                        row.isOverallBest
                          ? "text-sector-purple"
                          : "text-sector-green"
                      }
                      style={
                        row.isOverallBest
                          ? { textShadow: "0 0 8px rgba(180, 90, 255, 0.5)" }
                          : undefined
                      }
                    >
                      {formatLapTime(row.bestLap)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {standings.length === 0 && (
          <p className="text-white/20 text-[10px] text-center py-6">
            Loading timing data...
          </p>
        )}
      </div>
    </PanelWrapper>
  );
}
