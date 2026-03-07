"use client";

import { useCallback, useRef } from "react";
import { useReplay } from "@/contexts/ReplayContext";

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const SPEEDS = [1, 2, 4, 8, 16, 32];

export function ReplayBar() {
  const replay = useReplay();
  const scrubberRef = useRef<HTMLDivElement>(null);

  const handleScrub = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!replay || !scrubberRef.current) return;
      const rect = scrubberRef.current.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      replay.seek(fraction * replay.duration);
    },
    [replay],
  );

  const handleScrubDrag = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.buttons !== 1) return;
      handleScrub(e);
    },
    [handleScrub],
  );

  if (!replay || replay.status === "idle") return null;

  const isPlaying = replay.status === "playing";
  const isLoading = replay.status === "loading";
  const progress =
    replay.duration > 0 ? (replay.currentTime / replay.duration) * 100 : 0;

  const cycleSpeed = () => {
    const currentIdx = SPEEDS.indexOf(replay.speed);
    const nextIdx = (currentIdx + 1) % SPEEDS.length;
    replay.setSpeed(SPEEDS[nextIdx]);
  };

  return (
    <div
      className="flex items-center gap-3 px-4 h-10 shrink-0"
      style={{
        background: "linear-gradient(180deg, rgb(18, 20, 30) 0%, rgb(14, 16, 26) 100%)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
      }}
    >
      {/* Replay badge */}
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
        <span className="text-[10px] font-black uppercase tracking-wider text-amber-500/90">
          Replay
        </span>
      </div>

      {/* Session info */}
      {replay.sessionInfo && (
        <span className="text-[10px] text-white/40 truncate max-w-[200px]">
          {replay.sessionInfo.meetingName} — {replay.sessionInfo.sessionName}
        </span>
      )}

      {/* Play/Pause */}
      <button
        onClick={() => (isPlaying ? replay.pause() : replay.play())}
        disabled={isLoading}
        className="w-7 h-7 flex items-center justify-center rounded bg-white/[0.06] hover:bg-white/[0.1] transition-colors disabled:opacity-30"
      >
        {isLoading ? (
          <div className="w-3 h-3 border border-white/40 border-t-transparent rounded-full animate-spin" />
        ) : isPlaying ? (
          <svg width="10" height="12" viewBox="0 0 10 12" fill="white">
            <rect x="0" y="0" width="3" height="12" rx="0.5" />
            <rect x="7" y="0" width="3" height="12" rx="0.5" />
          </svg>
        ) : (
          <svg width="10" height="12" viewBox="0 0 10 12" fill="white">
            <polygon points="0,0 10,6 0,12" />
          </svg>
        )}
      </button>

      {/* Stop */}
      <button
        onClick={() => replay.stop()}
        className="w-7 h-7 flex items-center justify-center rounded bg-white/[0.06] hover:bg-white/[0.1] transition-colors"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="white">
          <rect x="0" y="0" width="10" height="10" rx="1" />
        </svg>
      </button>

      {/* Speed */}
      <button
        onClick={cycleSpeed}
        className="px-2 h-7 flex items-center justify-center rounded bg-white/[0.06] hover:bg-white/[0.1] transition-colors font-mono text-[11px] text-white/70 min-w-[40px]"
      >
        {replay.speed}x
      </button>

      {/* Time */}
      <span className="font-mono text-[11px] text-white/60 tabular-nums shrink-0">
        {formatTime(replay.currentTime)}
      </span>

      {/* Scrubber */}
      <div
        ref={scrubberRef}
        className="flex-1 h-2 bg-white/[0.06] rounded-full cursor-pointer relative group"
        onClick={handleScrub}
        onMouseMove={handleScrubDrag}
      >
        {/* Progress fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-75"
          style={{
            width: `${progress}%`,
            background:
              "linear-gradient(90deg, rgba(225, 6, 0, 0.6) 0%, #E10600 100%)",
          }}
        />
        {/* Playhead */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `calc(${progress}% - 6px)` }}
        />
      </div>

      {/* Duration */}
      <span className="font-mono text-[11px] text-white/40 tabular-nums shrink-0">
        {formatTime(replay.duration)}
      </span>

      {/* Close replay */}
      <button
        onClick={() => replay.stop()}
        className="text-white/30 hover:text-white/60 transition-colors text-xs ml-1"
        title="Exit replay"
      >
        ✕
      </button>
    </div>
  );
}
