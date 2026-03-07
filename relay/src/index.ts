import { F1SignalRClient } from "./signalr-client.js";
import { StateManager } from "./state-manager.js";
import { BroadcastServer } from "./ws-server.js";

const WS_PORT = parseInt(process.env.PORT || "8080", 10);
const BROADCAST_INTERVAL = parseInt(
  process.env.BROADCAST_INTERVAL || "1000",
  10,
);

console.log("=== F1 Live Timing Relay ===");
console.log(`WebSocket port: ${WS_PORT}`);
console.log(`Broadcast interval: ${BROADCAST_INTERVAL}ms`);

// State accumulator
const stateManager = new StateManager();

// SignalR client (connects to F1)
const signalr = new F1SignalRClient();

// WebSocket server (broadcasts to browsers)
const broadcast = new BroadcastServer(WS_PORT, stateManager);

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
process.on("SIGTERM", () => {
  console.log("[Main] SIGTERM received, shutting down...");
  signalr.disconnect();
  broadcast.close();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("[Main] SIGINT received, shutting down...");
  signalr.disconnect();
  broadcast.close();
  process.exit(0);
});
