"use client";

import { useState, useEffect } from "react";
import { PanelWrapper } from "@/components/layout/PanelWrapper";
import { useMeetings, useSessions } from "@/hooks/useOpenF1";
import { ChevronDown } from "lucide-react";

interface SessionSelectorProps {
  onSessionSelect: (sessionKey: string) => void;
}

export function SessionSelector({ onSessionSelect }: SessionSelectorProps) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState("2025");
  const [meetingKey, setMeetingKey] = useState<string | null>(null);

  const {
    data: meetings,
    isLoading: meetingsLoading,
    error: meetingsError,
  } = useMeetings(year);
  const { data: sessions, isLoading: sessionsLoading } =
    useSessions(meetingKey);

  // Auto-select most recent meeting when year changes
  useEffect(() => {
    if (meetings && meetings.length > 0) {
      setMeetingKey(meetings[meetings.length - 1].meeting_key.toString());
    }
  }, [meetings]);

  const years = Array.from({ length: currentYear - 2022 }, (_, i) =>
    (currentYear - i).toString(),
  );
  // Ensure 2025 is always in the list
  if (!years.includes("2025")) years.push("2025");
  years.sort((a, b) => Number(b) - Number(a));

  return (
    <PanelWrapper title="Session Selector">
      {meetingsError && (
        <div className="mb-3 px-4 py-3 rounded-lg bg-yellow-flag/10 border border-yellow-flag/20 text-sm">
          <p className="text-yellow-flag font-semibold">
            API temporarily restricted
          </p>
          <p className="text-white/50 text-xs mt-1">
            OpenF1 locks public access during live F1 sessions. Add an API key
            in your environment, or try again after the session ends.
          </p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {/* Year selector */}
        <div className="relative">
          <select
            value={year}
            onChange={(e) => {
              setYear(e.target.value);
              setMeetingKey(null);
            }}
            className="appearance-none bg-white/[0.06] border border-white/[0.1] rounded-lg px-4 py-2 pr-8 text-sm text-white focus:outline-none focus:border-cyan-primary/50 cursor-pointer"
          >
            {years.map((y) => (
              <option key={y} value={y} className="bg-obsidian-light">
                {y}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
        </div>

        {/* Meeting selector */}
        <div className="relative flex-1 min-w-[200px]">
          <select
            value={meetingKey ?? ""}
            onChange={(e) => setMeetingKey(e.target.value)}
            disabled={meetingsLoading || !meetings}
            className="appearance-none w-full bg-white/[0.06] border border-white/[0.1] rounded-lg px-4 py-2 pr-8 text-sm text-white focus:outline-none focus:border-cyan-primary/50 cursor-pointer disabled:opacity-40"
          >
            <option value="" className="bg-obsidian-light">
              {meetingsLoading ? "Loading races..." : "Select a race"}
            </option>
            {meetings?.map((m) => (
              <option
                key={m.meeting_key}
                value={m.meeting_key}
                className="bg-obsidian-light"
              >
                {m.meeting_name} — {m.country_name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
        </div>

        {/* Session buttons */}
        <div className="flex gap-2">
          {sessionsLoading && (
            <span className="text-xs text-white/30">Loading sessions...</span>
          )}
          {sessions?.map((s) => (
            <button
              key={s.session_key}
              onClick={() => onSessionSelect(s.session_key.toString())}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-white/[0.06] border border-white/[0.1] text-white/80 hover:bg-cyan-primary/20 hover:text-cyan-primary hover:border-cyan-primary/30 transition-colors"
            >
              {s.session_name}
            </button>
          ))}
        </div>
      </div>
    </PanelWrapper>
  );
}
