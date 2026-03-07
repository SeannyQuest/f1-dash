"use client";

import { useMemo } from "react";
import { useWeather } from "@/hooks/useF1Data";
import { Thermometer, Droplets, Wind, CloudRain } from "lucide-react";

interface WeatherStripProps {
  sessionKey: string | null;
  refetchInterval: number | false;
}

export function WeatherStrip({
  sessionKey,
  refetchInterval,
}: WeatherStripProps) {
  const { data: weatherData } = useWeather(sessionKey, refetchInterval);

  const latest = useMemo(() => {
    if (!weatherData || weatherData.length === 0) return null;
    return weatherData[weatherData.length - 1];
  }, [weatherData]);

  if (!latest) return null;

  const isRaining = latest.rainfall > 0;

  return (
    <div
      className="flex items-center gap-3 text-[11px] font-mono px-3 py-1 rounded"
      style={{
        background: isRaining
          ? "linear-gradient(90deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 100%)"
          : "rgba(255, 255, 255, 0.03)",
        border: isRaining
          ? "1px solid rgba(59, 130, 246, 0.2)"
          : "1px solid rgba(255, 255, 255, 0.04)",
      }}
    >
      {isRaining && <CloudRain className="w-3.5 h-3.5 text-blue-400" />}
      <span className="flex items-center gap-1">
        <Thermometer className="w-3 h-3 text-orange-400" />
        <span className="text-white/70 font-semibold">
          {Number(latest.air_temperature).toFixed(1)}&deg;
        </span>
      </span>
      <div className="w-px h-3 bg-white/10" />
      <span className="flex items-center gap-1">
        <Thermometer className="w-3 h-3 text-red-400" />
        <span className="text-white/70 font-semibold">
          {Number(latest.track_temperature).toFixed(1)}&deg;
        </span>
      </span>
      <div className="w-px h-3 bg-white/10" />
      <span className="flex items-center gap-1">
        <Droplets className="w-3 h-3 text-blue-400" />
        <span className="text-white/70 font-semibold">
          {Number(latest.humidity).toFixed(0)}%
        </span>
      </span>
      <div className="w-px h-3 bg-white/10" />
      <span className="flex items-center gap-1">
        <Wind className="w-3 h-3 text-white/50" />
        <span className="text-white/70 font-semibold">
          {Number(latest.wind_speed).toFixed(1)} m/s
        </span>
      </span>
    </div>
  );
}
