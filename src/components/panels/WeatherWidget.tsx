"use client";

import { useMemo } from "react";
import { PanelWrapper } from "@/components/layout/PanelWrapper";
import { useWeather } from "@/hooks/useOpenF1";
import { Thermometer, Droplets, Wind, CloudRain } from "lucide-react";

interface WeatherWidgetProps {
  sessionKey: string | null;
  isLive: boolean;
  refetchInterval: number | false;
}

export function WeatherWidget({ sessionKey, isLive, refetchInterval }: WeatherWidgetProps) {
  const { data: weatherData } = useWeather(sessionKey, refetchInterval);

  const latest = useMemo(() => {
    if (!weatherData || weatherData.length === 0) return null;
    return weatherData[weatherData.length - 1];
  }, [weatherData]);

  if (!sessionKey) {
    return (
      <PanelWrapper title="Weather" isLive={isLive}>
        <p className="text-white/30 text-sm">Select a session</p>
      </PanelWrapper>
    );
  }

  if (!latest) {
    return (
      <PanelWrapper title="Weather" isLive={isLive}>
        <p className="text-white/30 text-sm">Loading weather data...</p>
      </PanelWrapper>
    );
  }

  const isRaining = latest.rainfall > 0;

  return (
    <PanelWrapper title="Weather" isLive={isLive}>
      <div className={`grid grid-cols-2 gap-4 ${isRaining ? "bg-blue-500/5 rounded-xl p-2 -m-2" : ""}`}>
        <div className="flex items-center gap-3">
          <Thermometer className="w-5 h-5 text-orange-400" />
          <div>
            <p className="text-2xl font-bold font-mono">{latest.air_temperature.toFixed(1)}&deg;</p>
            <p className="text-xs text-white/40">Air Temp</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Thermometer className="w-5 h-5 text-red-400" />
          <div>
            <p className="text-2xl font-bold font-mono">{latest.track_temperature.toFixed(1)}&deg;</p>
            <p className="text-xs text-white/40">Track Temp</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Droplets className="w-5 h-5 text-blue-400" />
          <div>
            <p className="text-lg font-bold font-mono">{latest.humidity.toFixed(0)}%</p>
            <p className="text-xs text-white/40">Humidity</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Wind className="w-5 h-5 text-cyan-dim" />
          <div>
            <p className="text-lg font-bold font-mono">{latest.wind_speed.toFixed(1)}</p>
            <p className="text-xs text-white/40">Wind (m/s)</p>
          </div>
        </div>
        {isRaining && (
          <div className="col-span-2 flex items-center gap-3 bg-blue-500/10 rounded-lg px-3 py-2">
            <CloudRain className="w-5 h-5 text-blue-400" />
            <div>
              <p className="text-sm font-semibold text-blue-400">Rain Detected</p>
              <p className="text-xs text-white/40">Rainfall: {latest.rainfall}mm</p>
            </div>
          </div>
        )}
      </div>
    </PanelWrapper>
  );
}
