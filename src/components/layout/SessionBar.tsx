"use client";

import { useState, useEffect } from "react";
import { useMeetings, useSessions } from "@/hooks/useOpenF1";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { SessionSelection } from "@/hooks/useSessionState";

interface SessionBarProps {
  onSessionSelect: (info: SessionSelection) => void;
  hasActiveSession: boolean;
}

const SESSION_ABBREVS: Record<string, string> = {
  "Practice 1": "FP1",
  "Practice 2": "FP2",
  "Practice 3": "FP3",
  "Qualifying": "Q",
  "Sprint Qualifying": "SQ",
  "Sprint": "S",
  "Race": "R",
};

export function SessionBar({ onSessionSelect, hasActiveSession }: SessionBarProps) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState("2025");
  const [meetingKey, setMeetingKey] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const {
    data: meetings,
    isLoading: meetingsLoading,
    error: meetingsError,
  } = useMeetings(year);
  const { data: sessions, isLoading: sessionsLoading } = useSessions(meetingKey);

  useEffect(() => {
    if (meetings && meetings.length > 0) {
      setMeetingKey(meetings[meetings.length - 1].meeting_key.toString());
    }
  }, [meetings]);

  const years = Array.from({ length: currentYear - 2022 }, (_, i) =>
    (currentYear - i).toString(),
  );
  if (!years.includes("2025")) years.push("2025");
  years.sort((a, b) => Number(b) - Number(a));

  if (collapsed && hasActiveSession) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="flex items-center gap-2 h-7 px-4 border-b border-white/[0.04] text-[10px] text-white/30 hover:text-accent transition-colors shrink-0"
        style={{
          background: "linear-gradient(90deg, rgba(225, 6, 0, 0.04) 0%, transparent 30%)",
        }}
      >
        <ChevronDown className="w-3 h-3" />
        <span>Change session</span>
      </button>
    );
  }

  return (
    <div
      className="border-b border-white/[0.06] px-4 py-2 shrink-0 animate-[fade-in_0.2s_ease-out]"
      style={{
        background: "linear-gradient(180deg, rgba(16, 18, 28, 0.9) 0%, rgba(10, 12, 20, 0.9) 100%)",
      }}
    >
      {meetingsError && (
        <div className="mb-2 px-3 py-2 rounded bg-yellow-flag/10 border border-yellow-flag/20 text-[11px]">
          <span className="text-yellow-flag font-semibold">API restricted</span>
          <span className="text-white/40 ml-2">OpenF1 locks access during live sessions. Try again later.</span>
        </div>
      )}
      <div className="flex items-center gap-3">
        {/* Year */}
        <div className="relative">
          <select
            value={year}
            onChange={(e) => { setYear(e.target.value); setMeetingKey(null); }}
            className="appearance-none bg-white/[0.06] border border-white/[0.1] rounded px-3 py-1.5 pr-7 text-xs font-bold text-white focus:outline-none focus:border-accent/50 cursor-pointer"
          >
            {years.map((y) => (
              <option key={y} value={y} className="bg-bg-panel">{y}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 pointer-events-none" />
        </div>

        {/* Meeting */}
        <div className="relative flex-1 min-w-[180px] max-w-[400px]">
          <select
            value={meetingKey ?? ""}
            onChange={(e) => setMeetingKey(e.target.value)}
            disabled={meetingsLoading || !meetings}
            className="appearance-none w-full bg-white/[0.06] border border-white/[0.1] rounded px-3 py-1.5 pr-7 text-xs text-white focus:outline-none focus:border-accent/50 cursor-pointer disabled:opacity-40"
          >
            <option value="" className="bg-bg-panel">
              {meetingsLoading ? "Loading..." : "Select race"}
            </option>
            {meetings?.map((m) => (
              <option key={m.meeting_key} value={m.meeting_key} className="bg-bg-panel">
                {m.meeting_name} — {m.country_name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 pointer-events-none" />
        </div>

        {/* Session pills */}
        <div className="flex gap-1.5">
          {sessionsLoading && (
            <span className="text-[10px] text-white/20">Loading...</span>
          )}
          {sessions?.map((s) => {
            const abbrev = SESSION_ABBREVS[s.session_name] || s.session_name;
            return (
              <button
                key={s.session_key}
                onClick={() => {
                  onSessionSelect({
                    sessionKey: s.session_key.toString(),
                    circuitKey: s.circuit_key.toString(),
                    year: s.year.toString(),
                  });
                  setCollapsed(true);
                }}
                className="px-3 py-1.5 rounded text-xs font-bold border transition-all duration-200 hover:scale-105"
                style={{
                  background: "linear-gradient(180deg, rgba(225, 6, 0, 0.15) 0%, rgba(225, 6, 0, 0.05) 100%)",
                  borderColor: "rgba(225, 6, 0, 0.3)",
                  color: "rgba(255, 255, 255, 0.8)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "linear-gradient(180deg, rgba(225, 6, 0, 0.35) 0%, rgba(225, 6, 0, 0.15) 100%)";
                  e.currentTarget.style.borderColor = "rgba(225, 6, 0, 0.6)";
                  e.currentTarget.style.boxShadow = "0 0 12px rgba(225, 6, 0, 0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "linear-gradient(180deg, rgba(225, 6, 0, 0.15) 0%, rgba(225, 6, 0, 0.05) 100%)";
                  e.currentTarget.style.borderColor = "rgba(225, 6, 0, 0.3)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                {abbrev}
              </button>
            );
          })}
        </div>

        {/* Collapse button */}
        {hasActiveSession && (
          <button
            onClick={() => setCollapsed(true)}
            className="ml-auto text-white/20 hover:text-accent transition-colors"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
