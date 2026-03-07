"use client";

import { useRef, useEffect, useMemo } from "react";
import { PanelWrapper } from "@/components/layout/PanelWrapper";
import { useRaceControl } from "@/hooks/useF1Data";
import { FLAG_COLORS } from "@/lib/constants";

interface RaceControlFeedProps {
  sessionKey: string | null;
  isLive: boolean;
  refetchInterval: number | false;
}

function getCategoryBadge(
  message: string,
  flag?: string,
): { label: string; color: string } | null {
  const msg = message.toUpperCase();
  if (flag === "RED") return { label: "RED FLAG", color: "#ff1818" };
  if (flag === "YELLOW" || flag === "DOUBLE YELLOW")
    return { label: "FLAG", color: "#ffd000" };
  if (flag === "GREEN") return { label: "GREEN", color: "#00d25a" };
  if (flag === "CHEQUERED") return { label: "FINISH", color: "#ffffff" };
  if (msg.includes("SAFETY CAR") || msg.includes("VSC"))
    return { label: "SC", color: "#ff8c00" };
  if (msg.includes("DRS")) return { label: "DRS", color: "#00d25a" };
  if (msg.includes("PENALTY") || msg.includes("TIME PENALTY"))
    return { label: "PEN", color: "#ff1818" };
  if (msg.includes("INVESTIGATED") || msg.includes("INCIDENT"))
    return { label: "INC", color: "#ff8c00" };
  if (msg.includes("DELETED")) return { label: "DEL", color: "#a855f7" };
  if (msg.includes("PIT LANE")) return { label: "PIT", color: "#3b82f6" };
  return null;
}

export function RaceControlFeed({
  sessionKey,
  isLive,
  refetchInterval,
}: RaceControlFeedProps) {
  const { data: messages } = useRaceControl(sessionKey, refetchInterval);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sortedMessages = useMemo(() => {
    if (!messages) return [];
    return [...messages].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current && isLive) {
      scrollRef.current.scrollTop = 0;
    }
  }, [sortedMessages.length, isLive]);

  if (!sessionKey) {
    return (
      <PanelWrapper title="Race Control" isLive={isLive} className="h-full">
        <p className="text-white/20 text-xs">Select a session</p>
      </PanelWrapper>
    );
  }

  return (
    <PanelWrapper
      title="Race Control"
      isLive={isLive}
      className="h-full"
      rightSection={
        sortedMessages.length > 0 ? (
          <span
            className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
            style={{
              background: "rgba(225, 6, 0, 0.15)",
              color: "rgba(225, 6, 0, 0.8)",
            }}
          >
            {sortedMessages.length}
          </span>
        ) : undefined
      }
    >
      <div ref={scrollRef} className="space-y-0 overflow-y-auto h-full -mx-1">
        {sortedMessages.length === 0 && (
          <p className="text-white/20 text-[10px] text-center py-4">
            No messages
          </p>
        )}
        {sortedMessages.map((msg, i) => {
          const flagColor = msg.flag ? FLAG_COLORS[msg.flag] : undefined;
          const badge = getCategoryBadge(msg.message, msg.flag);
          const time = new Date(msg.date).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          });
          return (
            <div
              key={`${msg.date}-${i}`}
              className="flex items-start gap-2 py-2 px-2 last:border-0 rounded-sm transition-colors"
              style={{
                background: flagColor
                  ? `linear-gradient(90deg, ${flagColor}12 0%, transparent 60%)`
                  : i % 2 === 0
                    ? "rgba(255, 255, 255, 0.01)"
                    : "transparent",
                borderBottom: "1px solid rgba(255, 255, 255, 0.03)",
                borderLeft: flagColor
                  ? `3px solid ${flagColor}`
                  : "3px solid transparent",
                animation: `slide-in-right 0.3s ease-out ${i * 0.03}s both`,
              }}
            >
              <span className="text-[10px] text-white/25 font-mono shrink-0 pt-px tabular-nums">
                {time}
              </span>
              {badge && (
                <span
                  className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded shrink-0"
                  style={{
                    backgroundColor: `${badge.color}20`,
                    color: badge.color,
                    boxShadow: `0 0 8px ${badge.color}15`,
                    textShadow: `0 0 4px ${badge.color}40`,
                  }}
                >
                  {badge.label}
                </span>
              )}
              <span className="text-[11px] text-white/60 leading-tight">
                {msg.message}
              </span>
            </div>
          );
        })}
      </div>
    </PanelWrapper>
  );
}
