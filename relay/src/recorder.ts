/**
 * Records incoming F1 SignalR messages to disk in a format that is
 * byte-compatible with F1's public static archive (livetiming.formula1.com/static).
 *
 * Format per session directory:
 *   {topic}.jsonStream   → one line per update, "HH:MM:SS.fff{jsonValue}\n"
 *   {topic}.json         → initial keyframe snapshot (non-compressed topics only)
 *   metadata.json        → session id, start/end, duration, topic list
 *
 * Session-relative time starts from the first message received after the
 * recorder is opened (not F1 session start), so `HH:MM:SS.fff` is the
 * elapsed wall-clock time from when we began recording. This is sufficient
 * for replay because ReplayEngine treats t=0 as the first timeline entry.
 *
 * Writes are non-blocking — we do not await each line. A crash will at
 * worst lose the last few hundred milliseconds of buffered data.
 */

import {
  createWriteStream,
  mkdirSync,
  writeFileSync,
  type WriteStream,
} from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

type SessionInfoPayload = {
  Meeting?: {
    Key?: number;
    Name?: string;
    Location?: string;
    Country?: { Name?: string };
    Circuit?: { Key?: number; ShortName?: string };
  };
  Key?: number;
  Type?: string;
  Name?: string;
  StartDate?: string;
  EndDate?: string;
  GmtOffset?: string;
  Path?: string;
};

export interface RecorderOptions {
  /** Root directory for all recordings. Defaults to $F1_DASH_DATA_DIR or ~/.f1-dash. */
  dataDir?: string;
}

interface BufferedMessage {
  topic: string;
  payload: unknown;
  receivedAt: number;
  kind: "keyframe" | "delta";
}

interface Metadata {
  version: 1;
  recordingId: string;
  sessionKey?: number;
  year?: number;
  meetingKey?: number;
  meetingName?: string;
  circuit?: string;
  circuitKey?: number;
  sessionType?: string;
  sessionName?: string;
  startRecordedAt: string; // ISO, wall clock when recording started
  endRecordedAt?: string;
  durationSec?: number;
  topics: string[];
  status: "recording" | "complete" | "aborted";
}

const MAX_BUFFER_MESSAGES = 2000;

function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

function formatRelativeTimestamp(ms: number): string {
  // "HH:MM:SS.fff" where ms is elapsed since recording start
  const totalSec = ms / 1000;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  const frac = Math.floor(ms % 1000);
  return (
    String(h).padStart(2, "0") +
    ":" +
    String(m).padStart(2, "0") +
    ":" +
    String(s).padStart(2, "0") +
    "." +
    String(frac).padStart(3, "0")
  );
}

export class Recorder {
  private readonly rootDir: string;
  private sessionDir: string | null = null;
  private startedAt: number | null = null;
  private streams = new Map<string, WriteStream>();
  private topicsSeen = new Set<string>();
  private buffer: BufferedMessage[] = [];
  private metadata: Metadata | null = null;
  private _isRecording = false;

  constructor(opts: RecorderOptions = {}) {
    this.rootDir =
      opts.dataDir ??
      process.env.F1_DASH_DATA_DIR ??
      join(homedir(), ".f1-dash");
  }

  get isRecording(): boolean {
    return this._isRecording;
  }

  /**
   * Record an incoming message. `payload` should be the RAW pre-decompression
   * value: for plaintext topics, the parsed JSON object; for `.z` topics, the
   * base64 string as received from F1 (so the on-disk format matches F1 CDN).
   */
  tap(topic: string, payload: unknown, kind: "keyframe" | "delta"): void {
    const receivedAt = Date.now();

    // Before SessionInfo arrives we don't know the directory yet.
    // Buffer everything.
    if (this.sessionDir === null) {
      if (this.buffer.length < MAX_BUFFER_MESSAGES) {
        this.buffer.push({ topic, payload, receivedAt, kind });
      }
      // If SessionInfo is in the buffer, open now.
      if (topic === "SessionInfo" && this.isUsablePayload(payload)) {
        this.openFromSessionInfo(payload as SessionInfoPayload, receivedAt);
      }
      return;
    }

    // Session dir is open — write directly.
    this.writeMessage(topic, payload, receivedAt, kind);
  }

  /**
   * Called when the subscribe keyframe snapshot arrives (the I:1 R: field).
   * Each entry in `snapshot` is topic → raw payload (pre-decompression for .z).
   */
  captureKeyframes(snapshot: Record<string, unknown>): void {
    for (const [topic, payload] of Object.entries(snapshot)) {
      this.tap(topic, payload, "keyframe");
    }
  }

  /**
   * Stop the recorder and finalize metadata.json.
   * Returns a promise that resolves once all pending stream writes have flushed.
   */
  async stop(status: "complete" | "aborted" = "complete"): Promise<void> {
    if (!this._isRecording || !this.sessionDir || !this.metadata) {
      this._isRecording = false;
      return;
    }

    // End all streams and wait for them to flush.
    const pending: Promise<void>[] = [];
    for (const stream of this.streams.values()) {
      pending.push(
        new Promise<void>((resolve) => {
          stream.end(() => resolve());
        }),
      );
    }
    this.streams.clear();
    await Promise.all(pending);

    // Finalize metadata.
    const endedAt = new Date();
    this.metadata.endRecordedAt = endedAt.toISOString();
    this.metadata.durationSec =
      this.startedAt !== null
        ? Math.round((endedAt.getTime() - this.startedAt) / 1000)
        : undefined;
    this.metadata.topics = Array.from(this.topicsSeen).sort();
    this.metadata.status = status;

    try {
      writeFileSync(
        join(this.sessionDir, "metadata.json"),
        JSON.stringify(this.metadata, null, 2) + "\n",
      );
      console.log(
        `[Recorder] Stopped (${status}). ${this.sessionDir} — ${this.metadata.durationSec}s, ${this.topicsSeen.size} topics`,
      );
    } catch (err) {
      console.error(
        "[Recorder] Failed to write metadata.json:",
        (err as Error).message,
      );
    }

    this._isRecording = false;
  }

  // ── internals ──────────────────────────────────────────────────────────

  private isUsablePayload(val: unknown): val is Record<string, unknown> {
    return val !== null && typeof val === "object" && !Array.isArray(val);
  }

  private openFromSessionInfo(info: SessionInfoPayload, now: number): void {
    const year =
      info.StartDate && !isNaN(Date.parse(info.StartDate))
        ? new Date(info.StartDate).getUTCFullYear()
        : new Date(now).getUTCFullYear();

    const meetingName = info.Meeting?.Name ?? "Unknown_Meeting";
    const meetingKey = info.Meeting?.Key;
    const sessionType = info.Type ?? "Unknown";
    const sessionName = info.Name ?? sessionType;

    const meetingSlug = `${meetingKey !== undefined ? String(meetingKey).padStart(2, "0") + "_" : ""}${slugify(meetingName)}`;
    const sessionSlug = slugify(sessionName);
    const recordingId = `${year}_${meetingSlug}_${sessionSlug}`;

    const dir = join(
      this.rootDir,
      "recordings",
      String(year),
      meetingSlug,
      sessionSlug,
    );

    try {
      mkdirSync(dir, { recursive: true });
    } catch (err) {
      console.error(
        "[Recorder] Failed to create recording dir:",
        (err as Error).message,
      );
      return;
    }

    this.sessionDir = dir;
    this.startedAt = this.buffer[0]?.receivedAt ?? now;
    this._isRecording = true;

    this.metadata = {
      version: 1,
      recordingId,
      sessionKey: info.Key,
      year,
      meetingKey,
      meetingName,
      circuit: info.Meeting?.Circuit?.ShortName,
      circuitKey: info.Meeting?.Circuit?.Key,
      sessionType,
      sessionName,
      startRecordedAt: new Date(this.startedAt).toISOString(),
      topics: [],
      status: "recording",
    };

    console.log(`[Recorder] Opened ${dir}`);

    // Flush buffered messages in order.
    const buffered = this.buffer;
    this.buffer = [];
    for (const msg of buffered) {
      this.writeMessage(msg.topic, msg.payload, msg.receivedAt, msg.kind);
    }

    // Initial metadata write (so partial recordings are still discoverable).
    this.flushMetadata();
  }

  private writeMessage(
    topic: string,
    payload: unknown,
    receivedAt: number,
    kind: "keyframe" | "delta",
  ): void {
    if (!this.sessionDir || this.startedAt === null) return;

    this.topicsSeen.add(topic);

    try {
      if (kind === "keyframe") {
        // Keyframes go to {topic}.json only (F1 CDN convention).
        // Not written for .z topics — CDN doesn't provide those either.
        if (!topic.endsWith(".z")) {
          const keyframePath = join(this.sessionDir, `${topic}.json`);
          writeFileSync(keyframePath, JSON.stringify(payload));
        }
        return;
      }

      // Deltas go to {topic}.jsonStream.
      const streamPath = join(this.sessionDir, `${topic}.jsonStream`);
      const ts = formatRelativeTimestamp(receivedAt - this.startedAt);
      const line = ts + JSON.stringify(payload) + "\n";

      let stream = this.streams.get(topic);
      if (!stream) {
        stream = createWriteStream(streamPath, { flags: "a" });
        stream.on("error", (err) => {
          console.error(`[Recorder] Stream error for ${topic}:`, err.message);
        });
        this.streams.set(topic, stream);
      }
      stream.write(line); // fire-and-forget
    } catch (err) {
      console.error(
        `[Recorder] Write failed for ${topic}:`,
        (err as Error).message,
      );
    }
  }

  private flushMetadata(): void {
    if (!this.sessionDir || !this.metadata) return;
    try {
      writeFileSync(
        join(this.sessionDir, "metadata.json"),
        JSON.stringify(
          { ...this.metadata, topics: Array.from(this.topicsSeen).sort() },
          null,
          2,
        ) + "\n",
      );
    } catch {
      /* best-effort */
    }
  }
}
