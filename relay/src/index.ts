import { F1SignalRClient } from "./signalr-client.js";
import { StateManager } from "./state-manager.js";
import { BroadcastServer } from "./ws-server.js";
import { Recorder } from "./recorder.js";

const WS_PORT = parseInt(process.env.PORT || "8080", 10);
const BROADCAST_INTERVAL = parseInt(
  process.env.BROADCAST_INTERVAL || "1000",
  10,
);
const RECORDING_ENABLED = process.env.F1_DASH_RECORD !== "0";

console.log("=== F1 Live Timing Relay ===");
console.log(`WebSocket port: ${WS_PORT}`);
console.log(`Broadcast interval: ${BROADCAST_INTERVAL}ms`);
console.log(`Recording: ${RECORDING_ENABLED ? "enabled" : "disabled"}`);

// State accumulator
const stateManager = new StateManager();

// SignalR client (connects to F1)
const signalr = new F1SignalRClient();

// WebSocket server (broadcasts to browsers)
const broadcast = new BroadcastServer(WS_PORT, stateManager);

// Recorder — tees every inbound SignalR message to disk in F1-CDN format
const recorder = RECORDING_ENABLED ? new Recorder() : null;

// Wire up: SignalR data → state manager
signalr.on("data", (topic: string, data: unknown) => {
  // Log Position/CarData arrivals for debugging
  if (topic === "Position" || topic === "CarData") {
    const preview = JSON.stringify(data)?.slice(0, 150) ?? "null";
    console.log(
      `[Data] ${topic}: ${Array.isArray(data) ? "array" : typeof data} — ${preview}`,
    );
  }
  stateManager.update(topic, data);
});

// Wire up: SignalR raw (pre-decompression) → recorder
if (recorder) {
  signalr.on("raw", (topic: string, payload: unknown) => {
    recorder.tap(topic, payload, "delta");
  });
  signalr.on("keyframes", (snapshot: Record<string, unknown>) => {
    recorder.captureKeyframes(snapshot);
  });
}

signalr.on("connected", () => {
  console.log("[Main] Connected to F1 SignalR feed");
  broadcast.broadcastStatus("connected");
  broadcast.startBroadcasting(BROADCAST_INTERVAL);
});

signalr.on("disconnected", () => {
  console.log("[Main] Disconnected from F1 SignalR feed");
  broadcast.broadcastStatus("disconnected");
});

// Start
signalr.connect();

// Health check logging
setInterval(() => {
  const state = stateManager.getState();
  const driverCount = Object.keys(state.DriverList).length;
  const hasTimingData = Object.keys(state.TimingData).length > 0;
  const lastUpdate = state._lastUpdate
    ? `${((Date.now() - state._lastUpdate) / 1000).toFixed(1)}s ago`
    : "never";

  const hasPosition = state.Position !== null;
  console.log(
    `[Health] SignalR: ${signalr.connected ? "connected" : "disconnected"} | ` +
      `Clients: ${broadcast.getClientCount()} | ` +
      `Drivers: ${driverCount} | ` +
      `Timing: ${hasTimingData ? "yes" : "no"} | ` +
      `Position: ${hasPosition ? "yes" : "no"} | ` +
      `Last update: ${lastUpdate}`,
  );
}, 30_000);

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  console.log(`[Main] ${signal} received, shutting down...`);
  try {
    await recorder?.stop("complete");
  } catch (err) {
    console.error("[Main] Recorder stop failed:", (err as Error).message);
  }
  signalr.disconnect();
  broadcast.close();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
