"use client";

import { useMemo } from "react";
import { PanelWrapper } from "@/components/layout/PanelWrapper";
import { useTeamRadio, useDrivers } from "@/hooks/useF1Data";

const F1_STATIC_BASE = "https://livetiming.formula1.com/static";

interface RadioFeedProps {
  sessionKey: string | null;
  isLive: boolean;
  refetchInterval: number | false;
}

function formatClock(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

export function RadioFeed({
  sessionKey,
  isLive,
  refetchInterval,
}: RadioFeedProps) {
  const { data: radios, basePath } = useTeamRadio();
  const { data: drivers } = useDrivers(sessionKey, refetchInterval);

  const tlaByDriver = useMemo(() => {
    const m = new Map<number, string>();
    drivers?.forEach((d) => m.set(d.driver_number, d.name_acronym));
    return m;
  }, [drivers]);

  const items = useMemo(() => {
    if (!radios) return [];
    return radios.slice(0, 20);
  }, [radios]);

  const buildUrl = (path: string): string | null => {
    if (!basePath) return null;
    const trimmedBase = basePath.replace(/\/$/, "");
    return `${F1_STATIC_BASE}/${trimmedBase}/${path}`;
  };

  if (!sessionKey) {
    return (
      <PanelWrapper title="Team Radio" isLive={isLive} className="h-full">
        <p className="text-white/20 text-xs">Select a session</p>
      </PanelWrapper>
    );
  }

  return (
    <PanelWrapper title="Team Radio" isLive={isLive} className="h-full">
      {items.length === 0 ? (
        <p className="text-white/20 text-xs">
          No radio yet — available during live sessions and replay
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {items.map((r, i) => {
            const tla = tlaByDriver.get(r.driver_number) ?? `#${r.driver_number}`;
            const url = buildUrl(r.path);
            return (
              <div
                key={`${r.date}-${r.driver_number}-${i}`}
                className="flex items-center gap-2 px-2 py-1 rounded bg-white/[0.02] border border-white/[0.04]"
              >
                <span className="text-[10px] font-mono text-white/40 tabular-nums w-14">
                  {formatClock(r.date)}
                </span>
                <span className="text-[10px] font-bold text-white/90 w-8">
                  {tla}
                </span>
                {url ? (
                  <audio
                    controls
                    preload="none"
                    src={url}
                    className="flex-1 h-6"
                    style={{ maxHeight: 24 }}
                  />
                ) : (
                  <span className="text-[10px] text-white/30 italic flex-1">
                    audio path unavailable
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </PanelWrapper>
  );
}
