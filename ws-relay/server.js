import { WebSocketServer } from "ws";
import http from "http";

const PORT = process.env.PORT || 8080;
const OPENF1_USERNAME = process.env.OPENF1_USERNAME;
const OPENF1_PASSWORD = process.env.OPENF1_PASSWORD;
const OPENF1_API = "https://api.openf1.org/v1";
const OPENF1_TOKEN_URL = "https://api.openf1.org/token";
const POLL_MS = 300; // Poll OpenF1 every 300ms
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "").split(",").filter(Boolean);

// --- Auth ---
let cachedToken = null;

async function getToken() {
  if (!OPENF1_USERNAME || !OPENF1_PASSWORD) return null;
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }
  try {
    const res = await fetch(OPENF1_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        username: OPENF1_USERNAME,
        password: OPENF1_PASSWORD,
      }).toString(),
    });
    if (!res.ok) {
      console.error(`Token error: ${res.status}`);
      return cachedToken?.token || null;
    }
    const data = await res.json();
    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + parseInt(data.expires_in, 10) * 1000,
    };
    return cachedToken.token;
  } catch (e) {
    console.error("Token fetch failed:", e.message);
    return cachedToken?.token || null;
  }
}

async function fetchOpenF1(endpoint, params = {}) {
  const url = new URL(`${OPENF1_API}/${endpoint}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v != null) url.searchParams.set(k, v);
  });
  const headers = {};
  const token = await getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url.toString(), { headers });
  if (!res.ok) throw new Error(`OpenF1 ${res.status}`);
  return res.json();
}

// --- State ---
let activeSession = null; // { sessionKey, meetingKey }
let latestLocations = new Map(); // driver_number -> { x, y, z, date }
let latestTimestamp = null; // Track latest timestamp for incremental polling
let pollTimer = null;

// --- Polling ---
async function pollLocations() {
  if (!activeSession) return;
  try {
    const params = { session_key: activeSession.sessionKey };
    // Incremental: only fetch data newer than last seen
    if (latestTimestamp) {
      params["date>"] = latestTimestamp;
    }
    const data = await fetchOpenF1("location", params);
    if (!Array.isArray(data) || data.length === 0) return;

    // Update latest positions per driver
    for (const point of data) {
      latestLocations.set(point.driver_number, {
        x: point.x,
        y: point.y,
        z: point.z,
        date: point.date,
        driver_number: point.driver_number,
      });
    }

    // Track the latest timestamp for next incremental fetch
    latestTimestamp = data[data.length - 1].date;

    // Broadcast to all connected clients
    const payload = JSON.stringify({
      type: "locations",
      ts: Date.now(),
      data: Array.from(latestLocations.values()),
    });
    broadcast(payload);
  } catch (e) {
    // Don't spam logs during non-live sessions
    if (!e.message.includes("401")) {
      console.error("Poll error:", e.message);
    }
  }
}

function startPolling(sessionKey, meetingKey) {
  stopPolling();
  activeSession = { sessionKey, meetingKey };
  latestLocations.clear();
  latestTimestamp = null;
  console.log(`Polling started for session ${sessionKey}`);
  // Initial fetch, then interval
  pollLocations();
  pollTimer = setInterval(pollLocations, POLL_MS);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  activeSession = null;
  latestLocations.clear();
  latestTimestamp = null;
}

// --- WebSocket ---
const server = http.createServer((req, res) => {
  // Health check endpoint
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "ok",
      activeSession,
      clients: wss.clients.size,
      locations: latestLocations.size,
    }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });

function broadcast(payload) {
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(payload);
    }
  }
}

wss.on("connection", (ws, req) => {
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGINS.length > 0 && !ALLOWED_ORIGINS.includes(origin)) {
    console.log(`Rejected connection from origin: ${origin}`);
    ws.close(4003, "Origin not allowed");
    return;
  }

  console.log(`Client connected (total: ${wss.clients.size}), origin: ${origin}`);

  // Send current state immediately
  if (latestLocations.size > 0) {
    ws.send(JSON.stringify({
      type: "locations",
      ts: Date.now(),
      data: Array.from(latestLocations.values()),
    }));
  }

  // Send active session info
  if (activeSession) {
    ws.send(JSON.stringify({
      type: "session",
      sessionKey: activeSession.sessionKey,
    }));
  }

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === "subscribe" && msg.sessionKey) {
        // If a different session is requested, switch polling
        if (!activeSession || activeSession.sessionKey !== msg.sessionKey) {
          startPolling(msg.sessionKey, msg.meetingKey);
        }
        // Confirm subscription
        ws.send(JSON.stringify({
          type: "subscribed",
          sessionKey: msg.sessionKey,
        }));
      }

      if (msg.type === "ping") {
        ws.send(JSON.stringify({ type: "pong", ts: Date.now() }));
      }
    } catch {
      // Ignore malformed messages
    }
  });

  ws.on("close", () => {
    console.log(`Client disconnected (remaining: ${wss.clients.size})`);
    // Stop polling if no clients left
    if (wss.clients.size === 0) {
      console.log("No clients, stopping poll");
      stopPolling();
    }
  });
});

server.listen(PORT, () => {
  console.log(`F1 WS Relay running on port ${PORT}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down");
  stopPolling();
  wss.close();
  server.close();
});
