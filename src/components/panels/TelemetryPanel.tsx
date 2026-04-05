"use client";

import { useMemo, useState } from "react";
import { PanelWrapper } from "@/components/layout/PanelWrapper";
import { useCarData, useDrivers } from "@/hooks/useF1Data";
import type { CarData } from "@/types";

interface TelemetryPanelProps {
  sessionKey: string | null;
  isLive: boolean;
  refetchInterval: number | false;
}

/** DRS enum: 0=off, 8=available, 10/12/14=on (per race_bot decoder) */
function drsState(v: number): "off" | "available" | "on" {
  if (v >= 10) return "on";
  if (v === 8) return "available";
  return "off";
}

function drsColor(state: ReturnType<typeof drsState>): string {
  if (state === "on") return "#00d25a";
  if (state === "available") return "#ffd000";
  return "rgba(255,255,255,0.15)";
}

interface BarProps {
  label: string;
  value: number;
  max: number;
  color: string;
  unit?: string;
}

function Bar({ label, value, max, color, unit = "" }: BarProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-bold text-white/50 w-12 tracking-wide uppercase">
        {label}
      </span>
      <div className="relative h-2 flex-1 rounded bg-white/5 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded transition-[width] duration-100"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-[10px] font-mono text-white/80 w-10 text-right tabular-nums">
        {Math.round(value)}
        {unit}
      </span>
    </div>
  );
}

function DriverTelemetryRow({ car, tla }: { car: CarData; tla: string }) {
  const drs = drsState(car.drs);
  return (
    <div className="flex flex-col gap-1 p-2 rounded bg-white/[0.02] border border-white/[0.04]">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-white tracking-wide">{tla}</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-white/60 tabular-nums">
            {car.speed} km/h
          </span>
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded tabular-nums"
            style={{
              background:
                car.n_gear > 0 ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.02)",
              color: car.n_gear > 0 ? "#fff" : "rgba(255,255,255,0.3)",
            }}
          >
            GEAR {car.n_gear}
          </span>
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded"
            style={{
              background: drsColor(drs),
              color: drs === "off" ? "rgba(255,255,255,0.4)" : "#000",
            }}
          >
            DRS
          </span>
        </div>
      </div>
      <Bar label="THR" value={car.throttle} max={100} color="#00d25a" unit="%" />
      <Bar label="BRK" value={car.brake} max={100} color="#ff1818" unit="%" />
      <Bar label="RPM" value={car.rpm} max={15000} color="#3b82f6" />
    </div>
  );
}

export function TelemetryPanel({
  sessionKey,
  isLive,
  refetchInterval,
}: TelemetryPanelProps) {
  const { data: carData } = useCarData();
  const { data: drivers } = useDrivers(sessionKey, refetchInterval);
  const [selectedDriver, setSelectedDriver] = useState<number | null>(null);

  const driverLookup = useMemo(() => {
    const m = new Map<number, string>();
    drivers?.forEach((d) => m.set(d.driver_number, d.name_acronym));
    return m;
  }, [drivers]);

  // Default: show top 3 drivers' telemetry if nothing selected
  const visibleCars = useMemo(() => {
    if (!carData || carData.length === 0) return [];
    if (selectedDriver !== null) {
      return carData.filter((c) => c.driver_number === selectedDriver);
    }
    // Sort by the driver order as received and take top 3.
    return carData.slice(0, 3);
  }, [carData, selectedDriver]);

  if (!sessionKey) {
    return (
      <PanelWrapper title="Telemetry" isLive={isLive} className="h-full">
        <p className="text-white/20 text-xs">Select a session</p>
      </PanelWrapper>
    );
  }

  return (
    <PanelWrapper
      title="Telemetry"
      isLive={isLive}
      className="h-full"
      rightSection={
        <select
          value={selectedDriver ?? ""}
          onChange={(e) =>
            setSelectedDriver(e.target.value ? parseInt(e.target.value, 10) : null)
          }
          className="bg-white/5 border border-white/10 rounded text-[10px] text-white/80 px-1 py-0.5 hover:bg-white/10 focus:outline-none focus:border-white/30"
        >
          <option value="">Top 3</option>
          {drivers?.map((d) => (
            <option key={d.driver_number} value={d.driver_number}>
              {d.name_acronym}
            </option>
          ))}
        </select>
      }
    >
      {visibleCars.length === 0 ? (
        <p className="text-white/20 text-xs">
          Waiting for CarData feed (only available live or during replay)
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {visibleCars.map((car) => (
            <DriverTelemetryRow
              key={car.driver_number}
              car={car}
              tla={
                driverLookup.get(car.driver_number) ??
                `#${car.driver_number}`
              }
            />
          ))}
        </div>
      )}
    </PanelWrapper>
  );
}
