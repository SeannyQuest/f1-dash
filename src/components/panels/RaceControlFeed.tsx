"use client";

import { useRef, useEffect, useMemo } from "react";
import { PanelWrapper } from "@/components/layout/PanelWrapper";
import { useRaceControl } from "@/hooks/useOpenF1";
import { FLAG_COLORS } from "@/lib/constants";
import { Flag } from "lucide-react";

interface RaceControlFeedProps {
  sessionKey: string | null;
  isLive: boolean;
  refetchInterval: number | false;
}

export function RaceControlFeed({ sessionKey, isLive, refetchInterval }: RaceControlFeedProps) {
  const { data: messages } = useRaceControl(sessionKey, refetchInterval);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sortedMessages = useMemo(() => {
    if (!messages) return [];
    return [...messages].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current && isLive) {
      scrollRef.current.scrollTop = 0;
    }
  }, [sortedMessages.length, isLive]);

  if (!sessionKey) {
    return (
      <PanelWrapper title="Race Control" isLive={isLive}>
        <p className="text-white/30 text-sm">Select a session</p>
      </PanelWrapper>
    );
  }

  return (
    <PanelWrapper title="Race Control" isLive={isLive} className="max-h-[400px]">
      <div ref={scrollRef} className="space-y-2 overflow-y-auto max-h-[320px]">
        {sortedMessages.length === 0 && (
          <p className="text-white/30 text-sm text-center py-4">No race control messages</p>
        )}
        {sortedMessages.map((msg, i) => {
          const flagColor = msg.flag ? FLAG_COLORS[msg.flag] : undefined;
          const time = new Date(msg.date).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          });
          return (
            <div
              key={`${msg.date}-${i}`}
              className="flex items-start gap-3 py-2 border-b border-white/[0.04] last:border-0"
              style={flagColor ? { borderLeftWidth: 3, borderLeftColor: flagColor, paddingLeft: 12 } : {}}
            >
              <span className="text-xs text-white/30 font-mono shrink-0 pt-0.5">{time}</span>
              {msg.flag && (
                <Flag className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: flagColor }} />
              )}
              <span className="text-sm text-white/80">{msg.message}</span>
            </div>
          );
        })}
      </div>
    </PanelWrapper>
  );
}
