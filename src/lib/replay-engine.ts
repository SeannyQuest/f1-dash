/**
 * Replay engine for F1 archived timing data.
 *
 * Fetches static timing archives from F1's servers (via our proxy),
 * parses the timestamped .jsonStream files, and replays them through
 * the same state management pipeline used for live data.
 *
 * Archive format:
 *   - KeyFrame: {topic}.json — initial snapshot
 *   - Stream: {topic}.jsonStream — lines of "HH:MM:SS.fff{json}" delta updates
 *   - Position.z / CarData.z — base64+zlib compressed
 */

import { inflateRaw } from "pako";
import type { F1LiveState } from "./live-timing-adapter";

// ── Types ──

export interface ReplaySessionInfo {
  path: string; // e.g. "2026/2026-03-08_Australian_Grand_Prix/2026-03-06_Practice_1/"
  sessionKey: number;
  meetingName: string;
  sessionName: string;
  circuitKey: number;
  year: number;
  /** "cdn" = F1 static archive (default), "local" = on-disk recording. */
  source?: "cdn" | "local";
}

interface TimelineEntry {
  /** Seconds from session start */
  time: number;
  topic: string;
  data: unknown;
}

export interface ReplayState {
  status: "idle" | "loading" | "ready" | "playing" | "paused" | "error";
  error?: string;
  /** Total duration in seconds */
  duration: number;
  /** Current playback position in seconds */
  currentTime: number;
  /** Playback speed multiplier */
  speed: number;
  /** The accumulated F1 state at current playback position */
  f1State: F1LiveState | null;
  /** Session info */
  sessionInfo: ReplaySessionInfo | null;
}

type ReplayListener = (state: ReplayState) => void;

// ── Deep merge (same logic as relay's state-manager) ──

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return val !== null && typeof val === "object" && !Array.isArray(val);
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  for (const key of Object.keys(source)) {
    const srcVal = source[key];
    const tgtVal = target[key];
    if (isPlainObject(srcVal) && isPlainObject(tgtVal)) {
      deepMerge(tgtVal, srcVal);
    } else {
      target[key] = srcVal;
    }
  }
  return target;
}

function cloneState(state: F1LiveState): F1LiveState {
  return JSON.parse(JSON.stringify(state));
}

// ── Parsing ──

/** Parse "HH:MM:SS.fff" to seconds */
function parseTimestamp(ts: string): number {
  const match = ts.match(/^(\d+):(\d+):(\d+)\.(\d+)/);
  if (!match) return 0;
  const [, h, m, s, ms] = match;
  return (
    parseInt(h, 10) * 3600 +
    parseInt(m, 10) * 60 +
    parseInt(s, 10) +
    parseInt(ms.padEnd(3, "0").slice(0, 3), 10) / 1000
  );
}

/** Parse a .jsonStream file into timeline entries */
function parseJsonStream(topic: string, text: string): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  const lines = text.split("\n");

  for (const line of lines) {
    if (!line || line.length < 12) continue;

    // Format: "HH:MM:SS.fff{json}" — timestamp is always 12 chars
    const tsStr = line.slice(0, 12);
    const jsonStr = line.slice(12);
    if (!jsonStr) continue;

    const time = parseTimestamp(tsStr);

    try {
      const data = JSON.parse(jsonStr);
      entries.push({ time, topic, data });
    } catch {
      // Skip malformed lines
    }
  }

  return entries;
}

/**
 * Decompress base64-encoded raw-deflate data (for Position.z, CarData.z).
 *
 * F1's archive ships these as raw deflate streams — NOT zlib-wrapped — so
 * `inflateRaw` is required. Using `inflate` fails with "incorrect header check"
 * and every line silently returns null, leaving state.Position / state.CarData
 * empty and the TrackMap + TelemetryPanel blank during replay.
 */
function decompressZlib(data: string): unknown {
  try {
    const binaryStr = atob(data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const decompressed = inflateRaw(bytes);
    const text = new TextDecoder().decode(decompressed);
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Parse a compressed .jsonStream — each line's JSON value is a base64 string to decompress */
function parseCompressedJsonStream(
  topic: string,
  text: string,
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  const lines = text.split("\n");

  for (const line of lines) {
    if (!line || line.length < 12) continue;

    const tsStr = line.slice(0, 12);
    const jsonStr = line.slice(12);
    if (!jsonStr) continue;

    const time = parseTimestamp(tsStr);

    try {
      // The value is a JSON string containing base64 data
      const base64 = JSON.parse(jsonStr);
      if (typeof base64 !== "string") continue;
      const data = decompressZlib(base64);
      if (data != null) {
        entries.push({ time, topic, data });
      }
    } catch {
      // Skip
    }
  }

  return entries;
}

// ── Replay Engine ──

const TOPICS_TO_FETCH = [
  "TimingData",
  "TimingStats",
  "TimingAppData",
  "WeatherData",
  "TrackStatus",
  "DriverList",
  "RaceControlMessages",
  "SessionInfo",
  "SessionData",
  "ExtrapolatedClock",
  "LapCount",
  "TopThree",
  "TeamRadio",
  // Added in Gap #4
  "SessionStatus",
  "PitLaneTimeCollection",
  "ChampionshipPrediction",
  "DriverRaceInfo",
  "TyreStintSeries",
  "CurrentTyres",
];

const COMPRESSED_TOPICS = ["Position.z", "CarData.z"];

function makeEmptyState(): F1LiveState {
  return {
    TimingData: {},
    TimingStats: {},
    TimingAppData: {},
    CarData: null,
    Position: null,
    WeatherData: {},
    TrackStatus: {},
    DriverList: {},
    RaceControlMessages: {},
    SessionInfo: {},
    SessionData: {},
    ExtrapolatedClock: {},
    LapCount: { CurrentLap: 0, TotalLaps: 0 },
    TopThree: {},
    TeamRadio: {},
    Heartbeat: null,
    _lastUpdate: 0,
  };
}

export class ReplayEngine {
  private timeline: TimelineEntry[] = [];
  private keyframes: Record<string, unknown> = {};
  private state: ReplayState = {
    status: "idle",
    duration: 0,
    currentTime: 0,
    speed: 1,
    f1State: null,
    sessionInfo: null,
  };
  private listeners = new Set<ReplayListener>();
  private animationFrame: number | null = null;
  private lastTickTime: number = 0;
  /** Index of the next timeline entry to apply */
  private timelineIndex: number = 0;
  /** Source of the currently loaded session — determines which proxy route to call. */
  private source: "cdn" | "local" = "cdn";

  subscribe(listener: ReplayListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  private updateState(partial: Partial<ReplayState>) {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  getState(): ReplayState {
    return this.state;
  }

  /** Load a session's archived data */
  async load(session: ReplaySessionInfo): Promise<void> {
    this.stop();
    this.source = session.source ?? "cdn";
    this.updateState({
      status: "loading",
      sessionInfo: session,
      currentTime: 0,
      f1State: null,
      error: undefined,
    });

    try {
      const basePath = session.path.replace(/\/$/, "");

      // Fetch all keyframes and streams in parallel
      const fetchPromises: Promise<void>[] = [];
      const allEntries: TimelineEntry[] = [];
      const keyframes: Record<string, unknown> = {};

      for (const topic of TOPICS_TO_FETCH) {
        // Keyframe
        fetchPromises.push(
          this.fetchArchive(`${basePath}/${topic}.json`).then((text) => {
            if (text) {
              try {
                const data = JSON.parse(
                  text.charCodeAt(0) === 0xfeff ? text.slice(1) : text,
                );
                keyframes[topic] = data;
              } catch {
                /* skip */
              }
            }
          }),
        );

        // Stream
        fetchPromises.push(
          this.fetchArchive(`${basePath}/${topic}.jsonStream`).then((text) => {
            if (text) {
              const cleaned =
                text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
              const entries = parseJsonStream(topic, cleaned);
              allEntries.push(...entries);
            }
          }),
        );
      }

      // Compressed topics
      for (const topic of COMPRESSED_TOPICS) {
        const cleanTopic = topic.replace(".z", "");
        fetchPromises.push(
          this.fetchArchive(`${basePath}/${topic}.jsonStream`).then((text) => {
            if (text) {
              const cleaned =
                text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
              const entries = parseCompressedJsonStream(cleanTopic, cleaned);
              allEntries.push(...entries);
            }
          }),
        );
      }

      await Promise.all(fetchPromises);

      // Sort timeline by timestamp
      allEntries.sort((a, b) => a.time - b.time);

      this.timeline = allEntries;
      this.keyframes = keyframes;
      this.timelineIndex = 0;

      const duration =
        allEntries.length > 0 ? allEntries[allEntries.length - 1].time : 0;

      // Build initial state from keyframes
      const f1State = makeEmptyState();
      for (const [topic, data] of Object.entries(keyframes)) {
        this.applyUpdate(f1State, topic, data);
      }

      this.updateState({
        status: "ready",
        duration,
        currentTime: 0,
        f1State: cloneState(f1State),
      });
    } catch (err) {
      this.updateState({
        status: "error",
        error: (err as Error).message,
      });
    }
  }

  private async fetchArchive(path: string): Promise<string | null> {
    try {
      let url: string;
      if (this.source === "local") {
        // `path` for local is "{recordingId}/{filename}" — split on the last slash.
        const lastSlash = path.lastIndexOf("/");
        const id = path.slice(0, lastSlash);
        const file = path.slice(lastSlash + 1);
        url = `/api/f1/local-recordings?id=${encodeURIComponent(id)}&file=${encodeURIComponent(file)}`;
      } else {
        url = `/api/f1/replay?path=${encodeURIComponent(path)}`;
      }
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  }

  private applyUpdate(state: F1LiveState, topic: string, data: unknown): void {
    const key = topic as keyof F1LiveState;
    if (key === "_lastUpdate") return;

    if (isPlainObject(data) && isPlainObject(state[key] as unknown)) {
      deepMerge(
        state[key] as Record<string, unknown>,
        data as Record<string, unknown>,
      );
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (state as any)[key] = data;
    }

    state._lastUpdate = Date.now();
  }

  /** Rebuild state from keyframes + all entries up to the given time */
  private buildStateAtTime(time: number): F1LiveState {
    const state = makeEmptyState();

    // Apply keyframes first
    for (const [topic, data] of Object.entries(this.keyframes)) {
      this.applyUpdate(state, topic, data);
    }

    // Apply all timeline entries up to the target time
    for (let i = 0; i < this.timeline.length; i++) {
      const entry = this.timeline[i];
      if (entry.time > time) {
        this.timelineIndex = i;
        return state;
      }
      this.applyUpdate(state, entry.topic, entry.data);
    }

    this.timelineIndex = this.timeline.length;
    return state;
  }

  // ── Playback Controls ──

  play(): void {
    if (this.state.status !== "ready" && this.state.status !== "paused") return;
    this.lastTickTime = performance.now();
    this.updateState({ status: "playing" });
    this.tick();
  }

  pause(): void {
    if (this.state.status !== "playing") return;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    this.updateState({ status: "paused" });
  }

  stop(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    if (this.state.status === "playing" || this.state.status === "paused") {
      this.updateState({ status: "ready", currentTime: 0 });
    }
  }

  seek(time: number): void {
    const clampedTime = Math.max(0, Math.min(time, this.state.duration));
    const f1State = this.buildStateAtTime(clampedTime);

    const wasPlaying = this.state.status === "playing";
    this.updateState({
      currentTime: clampedTime,
      f1State: cloneState(f1State),
      status: wasPlaying
        ? "playing"
        : this.state.status === "idle"
          ? "ready"
          : this.state.status,
    });

    if (wasPlaying) {
      this.lastTickTime = performance.now();
    }
  }

  setSpeed(speed: number): void {
    this.updateState({ speed });
  }

  private tick = (): void => {
    if (this.state.status !== "playing") return;

    const now = performance.now();
    const deltaMs = now - this.lastTickTime;
    this.lastTickTime = now;

    const deltaSeconds = (deltaMs / 1000) * this.state.speed;
    let newTime = this.state.currentTime + deltaSeconds;

    // Apply all timeline entries between current time and new time
    let stateChanged = false;
    const currentState = this.state.f1State
      ? (JSON.parse(JSON.stringify(this.state.f1State)) as F1LiveState)
      : makeEmptyState();

    while (
      this.timelineIndex < this.timeline.length &&
      this.timeline[this.timelineIndex].time <= newTime
    ) {
      const entry = this.timeline[this.timelineIndex];
      this.applyUpdate(currentState, entry.topic, entry.data);
      this.timelineIndex++;
      stateChanged = true;
    }

    // Check if we've reached the end
    if (newTime >= this.state.duration) {
      newTime = this.state.duration;
      this.updateState({
        currentTime: newTime,
        f1State: stateChanged ? cloneState(currentState) : this.state.f1State,
        status: "paused",
      });
      return;
    }

    this.updateState({
      currentTime: newTime,
      f1State: stateChanged ? cloneState(currentState) : this.state.f1State,
    });

    this.animationFrame = requestAnimationFrame(this.tick);
  };

  destroy(): void {
    this.stop();
    this.listeners.clear();
    this.timeline = [];
    this.keyframes = {};
  }
}
