"use client";

import { useState, useMemo } from "react";
import { PanelWrapper } from "@/components/layout/PanelWrapper";
import { useDrivers, useLaps } from "@/hooks/useOpenF1";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface LapTimeChartProps {
  sessionKey: string | null;
  isLive: boolean;
  refetchInterval: number | false;
}

export function LapTimeChart({
  sessionKey,
  isLive,
  refetchInterval,
}: LapTimeChartProps) {
  const { data: drivers } = useDrivers(sessionKey);
  const { data: allLaps } = useLaps(sessionKey, undefined, refetchInterval);
  const [selectedDrivers, setSelectedDrivers] = useState<number[]>([]);

  const chartData = useMemo(() => {
    if (!allLaps || selectedDrivers.length === 0) return [];

    // Group laps by lap number
    const lapMap = new Map<number, Record<string, number>>();
    allLaps
      .filter(
        (l) =>
          selectedDrivers.includes(l.driver_number) &&
          l.lap_duration &&
          !l.is_pit_out_lap &&
          l.lap_duration < 200,
      )
      .forEach((l) => {
        const entry = lapMap.get(l.lap_number) ?? { lap: l.lap_number };
        entry[`d_${l.driver_number}`] = l.lap_duration!;
        lapMap.set(l.lap_number, entry);
      });

    return Array.from(lapMap.values()).sort((a, b) => a.lap - b.lap);
  }, [allLaps, selectedDrivers]);

  const toggleDriver = (driverNum: number) => {
    setSelectedDrivers((prev) =>
      prev.includes(driverNum)
        ? prev.filter((d) => d !== driverNum)
        : prev.length < 4
          ? [...prev, driverNum]
          : prev,
    );
  };

  if (!sessionKey) {
    return (
      <PanelWrapper title="Lap Times" isLive={isLive}>
        <p className="text-white/30 text-sm">Select a session</p>
      </PanelWrapper>
    );
  }

  return (
    <PanelWrapper title="Lap Times" isLive={isLive}>
      {/* Driver selector */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {drivers?.map((d) => {
          const isSelected = selectedDrivers.includes(d.driver_number);
          const color = d.team_colour.startsWith("#")
            ? d.team_colour
            : `#${d.team_colour}`;
          return (
            <button
              key={d.driver_number}
              onClick={() => toggleDriver(d.driver_number)}
              className={`px-2 py-1 rounded text-xs font-mono font-semibold transition-colors border ${
                isSelected
                  ? "border-transparent text-white"
                  : "border-white/[0.08] text-white/40 hover:text-white/60"
              }`}
              style={
                isSelected
                  ? { backgroundColor: `${color}40`, borderColor: color }
                  : {}
              }
            >
              {d.name_acronym}
            </button>
          );
        })}
        {selectedDrivers.length >= 4 && (
          <span className="text-xs text-white/30 self-center ml-2">
            Max 4 drivers
          </span>
        )}
      </div>

      {/* Chart */}
      {selectedDrivers.length === 0 ? (
        <p className="text-white/30 text-sm text-center py-8">
          Select up to 4 drivers to compare lap times
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.06)"
            />
            <XAxis
              dataKey="lap"
              stroke="rgba(255,255,255,0.3)"
              tick={{ fontSize: 11 }}
              label={{
                value: "Lap",
                position: "insideBottom",
                offset: -5,
                style: { fill: "rgba(255,255,255,0.3)" },
              }}
            />
            <YAxis
              stroke="rgba(255,255,255,0.3)"
              tick={{ fontSize: 11 }}
              domain={["auto", "auto"]}
              tickFormatter={(v: number) => {
                const mins = Math.floor(v / 60);
                const secs = (v % 60).toFixed(0);
                return mins > 0
                  ? `${mins}:${secs.padStart(2, "0")}`
                  : `${v.toFixed(0)}s`;
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgb(18, 18, 24)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={(label) => `Lap ${label}`}
              formatter={(value) => {
                const v = Number(value);
                const mins = Math.floor(v / 60);
                const secs = (v % 60).toFixed(3);
                return mins > 0
                  ? `${mins}:${secs.padStart(6, "0")}`
                  : `${secs}s`;
              }}
            />
            {selectedDrivers.map((driverNum) => {
              const driver = drivers?.find(
                (d) => d.driver_number === driverNum,
              );
              const color = driver?.team_colour
                ? driver.team_colour.startsWith("#")
                  ? driver.team_colour
                  : `#${driver.team_colour}`
                : "#888";
              return (
                <Line
                  key={driverNum}
                  type="monotone"
                  dataKey={`d_${driverNum}`}
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  name={driver?.name_acronym ?? String(driverNum)}
                  connectNulls
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      )}
    </PanelWrapper>
  );
}
