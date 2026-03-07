"use client";

import { useState, useEffect, useCallback } from "react";
import { useMeetings, useSessions } from "@/hooks/useOpenF1";
import { useLiveTiming } from "@/contexts/LiveTimingContext";
import { useReplay } from "@/contexts/ReplayContext";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { SessionSelection } from "@/hooks/useSessionState";
import type { ReplaySessionInfo } from "@/lib/replay-engine";

interface ReplaySessionMeta {
  sessionKey: number;
  sessionName: string;
  path: string;
  meetingKey: number;
  meetingName: string;
  circuitKey: number;
  year: number;
}

interface SessionBarProps {
  onSessionSelect: (info: SessionSelection) => void;
  hasActiveSession: boolean;
}

const SESSION_ABBREVS: Record<string, string> = {
  "Practice 1": "FP1",
  "Practice 2": "FP2",
  "Practice 3": "FP3",
  Qualifying: "Q",
  "Sprint Qualifying": "SQ",
  Sprint: "S",
  Race: "R",
};

export function SessionBar({
  onSessionSelect,
  hasActiveSession,
}: SessionBarProps) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [meetingKey, setMeetingKey] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const liveTiming = useLiveTiming();
  const replay = useReplay();

  // Replay archive sessions (fetched from F1 static index)
  const [replaySessions, setReplaySessions] = useState<ReplaySessionMeta[]>([]);

  // Fetch replay-available sessions when year changes
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/f1/replay-sessions?year=${year}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.sessions) {
          setReplaySessions(data.sessions);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [year]);

  const hasLiveSession =
    liveTiming.connected &&
    liveTiming.drivers !== null &&
    liveTiming.liveSessionInfo.sessionKey !== null;

  const {
    data: meetings,
    isLoading: meetingsLoading,
    error: meetingsError,
  } = useMeetings(year);
  const { data: sessions, isLoading: sessionsLoading } =
    useSessions(meetingKey);

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

  // Find the replay archive path for a given session key
  const findReplaySession = useCallback(
    (sessionKey: number): ReplaySessionMeta | undefined => {
      return replaySessions.find((r) => r.sessionKey === sessionKey);
    },
    [replaySessions],
  );

  const startReplay = useCallback(
    (meta: ReplaySessionMeta) => {
      if (!replay) return;
      const info: ReplaySessionInfo = {
        path: meta.path,
        sessionKey: meta.sessionKey,
        meetingName: meta.meetingName,
        sessionName: meta.sessionName,
        circuitKey: meta.circuitKey,
        year: meta.year,
      };
      // Set the session in the URL so circuit data loads
      onSessionSelect({
        sessionKey: String(meta.sessionKey),
        circuitKey: String(meta.circuitKey),
        year: String(meta.year),
      });
      replay.load(info);
      setCollapsed(true);
    },
    [replay, onSessionSelect],
  );

  if (collapsed && hasActiveSession) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="flex items-center gap-2 h-7 px-4 border-b border-white/[0.04] text-[10px] text-white/30 hover:text-accent transition-colors shrink-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(225, 6, 0, 0.04) 0%, transparent 30%)",
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
        background:
          "linear-gradient(180deg, rgba(16, 18, 28, 0.9) 0%, rgba(10, 12, 20, 0.9) 100%)",
      }}
    >
      {meetingsError && (
        <div className="mb-2 px-3 py-2 rounded bg-yellow-flag/10 border border-yellow-flag/20 text-[11px]">
          <span className="text-yellow-flag font-semibold">API restricted</span>
          <span className="text-white/40 ml-2">
            OpenF1 locks access during live sessions. Try again later.
          </span>
        </div>
      )}
      {/* Live session auto-connect button */}
      {hasLiveSession && (
        <button
          onClick={() => {
            const info = liveTiming.liveSessionInfo;
            onSessionSelect({
              sessionKey: info.sessionKey!,
              circuitKey: info.circuitKey ?? undefined,
              year: info.year ?? undefined,
            });
            setCollapsed(true);
          }}
          className="mb-2 flex items-center gap-2 w-full px-3 py-2.5 rounded text-left transition-all duration-200 hover:scale-[1.01]"
          style={{
            background:
              "linear-gradient(135deg, rgba(225, 6, 0, 0.25) 0%, rgba(225, 6, 0, 0.08) 100%)",
            border: "1px solid rgba(225, 6, 0, 0.5)",
            boxShadow: "0 0 16px rgba(225, 6, 0, 0.15)",
          }}
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E10600] opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#E10600]" />
          </span>
          <span className="text-[11px] font-bold text-white/90 uppercase tracking-wider">
            LIVE — {liveTiming.liveSessionInfo.meetingName ?? "Session"}{" "}
            {liveTiming.liveSessionInfo.sessionName
              ? `· ${liveTiming.liveSessionInfo.sessionName}`
              : ""}
          </span>
          <span className="ml-auto text-[10px] text-white/40">
            Click to connect
          </span>
        </button>
      )}

      <div className="flex items-center gap-3">
        {/* Year */}
        <div className="relative">
          <select
            value={year}
            onChange={(e) => {
              setYear(e.target.value);
              setMeetingKey(null);
            }}
            className="appearance-none bg-white/[0.06] border border-white/[0.1] rounded px-3 py-1.5 pr-7 text-xs font-bold text-white focus:outline-none focus:border-accent/50 cursor-pointer"
          >
            {years.map((y) => (
              <option key={y} value={y} className="bg-bg-panel">
                {y}
              </option>
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
              <option
                key={m.meeting_key}
                value={m.meeting_key}
                className="bg-bg-panel"
              >
                {m.meeting_name} — {m.country_name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 pointer-events-none" />
        </div>

        {/* Session pills — each has a click for static view and a replay button */}
        <div className="flex gap-1.5">
          {sessionsLoading && (
            <span className="text-[10px] text-white/20">Loading...</span>
          )}
          {sessions?.map((s) => {
            const abbrev = SESSION_ABBREVS[s.session_name] || s.session_name;
            const replayMeta = findReplaySession(s.session_key);
            return (
              <div key={s.session_key} className="flex items-center">
                <button
                  onClick={() => {
                    onSessionSelect({
                      sessionKey: s.session_key.toString(),
                      circuitKey: s.circuit_key.toString(),
                      year: s.year.toString(),
                    });
                    setCollapsed(true);
                  }}
                  className="px-3 py-1.5 rounded-l text-xs font-bold border transition-all duration-200 hover:scale-105"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(225, 6, 0, 0.15) 0%, rgba(225, 6, 0, 0.05) 100%)",
                    borderColor: "rgba(225, 6, 0, 0.3)",
                    color: "rgba(255, 255, 255, 0.8)",
                    borderRight: replayMeta ? "none" : undefined,
                    borderRadius: replayMeta ? "4px 0 0 4px" : "4px",
                  }}
                >
                  {abbrev}
                </button>
                {replayMeta && (
                  <button
                    onClick={() => startReplay(replayMeta)}
                    title={`Replay ${s.session_name}`}
                    className="px-1.5 py-1.5 rounded-r border border-l-0 transition-all duration-200 hover:scale-105 group"
                    style={{
                      background:
                        "linear-gradient(180deg, rgba(245, 158, 11, 0.15) 0%, rgba(245, 158, 11, 0.05) 100%)",
                      borderColor: "rgba(245, 158, 11, 0.3)",
                    }}
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 10 10"
                      className="text-amber-500/70 group-hover:text-amber-400"
                      fill="currentColor"
                    >
                      <polygon points="2,0 10,5 2,10" />
                    </svg>
                  </button>
                )}
              </div>
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
