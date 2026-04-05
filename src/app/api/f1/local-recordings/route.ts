import { NextRequest, NextResponse } from "next/server";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lists and serves locally-recorded F1 sessions.
 *
 * Recordings live at $F1_DASH_DATA_DIR/recordings/{year}/{meeting_slug}/{session_slug}/
 * (default $HOME/.f1-dash). Each session directory contains:
 *   - metadata.json
 *   - {topic}.json        (keyframes)
 *   - {topic}.jsonStream  (timestamped deltas)
 *
 * Usage:
 *   GET /api/f1/local-recordings                    → list recordings
 *   GET /api/f1/local-recordings?id={id}&file=X     → stream a single file from that recording
 */

function getDataDir(): string {
  return process.env.F1_DASH_DATA_DIR ?? join(homedir(), ".f1-dash");
}

function getRecordingsRoot(): string {
  return join(getDataDir(), "recordings");
}

interface RecordingMetadata {
  version: number;
  recordingId: string;
  sessionKey?: number;
  year?: number;
  meetingKey?: number;
  meetingName?: string;
  circuit?: string;
  circuitKey?: number;
  sessionType?: string;
  sessionName?: string;
  startRecordedAt: string;
  endRecordedAt?: string;
  durationSec?: number;
  topics: string[];
  status: string;
}

interface ListedRecording extends RecordingMetadata {
  /** Relative path under the recordings root, e.g. "2026/03_Australian_Grand_Prix/Race" */
  relPath: string;
}

async function walkRecordings(): Promise<ListedRecording[]> {
  const root = getRecordingsRoot();

  let years: string[];
  try {
    years = await readdir(root);
  } catch {
    return [];
  }

  const results: ListedRecording[] = [];

  for (const year of years) {
    if (!/^\d{4}$/.test(year)) continue;
    const yearDir = join(root, year);

    let meetings: string[];
    try {
      meetings = await readdir(yearDir);
    } catch {
      continue;
    }

    for (const meeting of meetings) {
      const meetingDir = join(yearDir, meeting);
      let sessions: string[];
      try {
        sessions = await readdir(meetingDir);
      } catch {
        continue;
      }

      for (const session of sessions) {
        const sessionDir = join(meetingDir, session);
        const metadataPath = join(sessionDir, "metadata.json");
        try {
          const st = await stat(sessionDir);
          if (!st.isDirectory()) continue;
          const raw = await readFile(metadataPath, "utf8");
          const meta = JSON.parse(raw) as RecordingMetadata;
          results.push({
            ...meta,
            relPath: `${year}/${meeting}/${session}`,
          });
        } catch {
          // No metadata.json or unreadable — skip.
        }
      }
    }
  }

  // Most recent first.
  results.sort((a, b) =>
    (b.startRecordedAt || "").localeCompare(a.startRecordedAt || ""),
  );
  return results;
}

function isSafeRelPath(relPath: string): boolean {
  // Allow slashes, letters, digits, underscores, dashes, dots. No "..".
  if (!/^[\w\-./]+$/.test(relPath)) return false;
  if (relPath.includes("..")) return false;
  return true;
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const file = req.nextUrl.searchParams.get("file");

  // No id → list mode
  if (!id) {
    try {
      const recordings = await walkRecordings();
      return NextResponse.json(
        { recordings, dataDir: getDataDir() },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (err) {
      return NextResponse.json(
        { error: (err as Error).message },
        { status: 500 },
      );
    }
  }

  // id + file → stream single file
  if (!file) {
    return NextResponse.json(
      { error: "file param required when id is given" },
      { status: 400 },
    );
  }

  if (!isSafeRelPath(id) || !isSafeRelPath(file)) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 });
  }

  const fullPath = join(getRecordingsRoot(), id, file);
  try {
    const contents = await readFile(fullPath, "utf8");
    return new NextResponse(contents, {
      headers: {
        "Content-Type": file.endsWith(".json")
          ? "application/json"
          : "text/plain",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
