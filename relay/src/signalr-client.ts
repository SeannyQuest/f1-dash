import { WebSocket } from "ws";
import { inflateRawSync } from "zlib";
import { EventEmitter } from "events";

const F1_BASE = "https://livetiming.formula1.com/signalr";
const HUB = "Streaming";

const TOPICS = [
  "Heartbeat",
  "CarData.z",
  "Position.z",
  "ExtrapolatedClock",
  "TopThree",
  "TimingStats",
  "TimingAppData",
  "WeatherData",
  "TrackStatus",
  "DriverList",
  "RaceControlMessages",
  "SessionInfo",
  "SessionData",
  "LapCount",
  "TimingData",
  "TeamRadio",
];

interface NegotiateResponse {
  ConnectionToken: string;
  ConnectionId: string;
  KeepAliveTimeout: number;
  DisconnectTimeout: number;
  TransportConnectTimeout: number;
  TryWebSockets: boolean;
  ProtocolVersion: string;
}

interface SignalRMessage {
  C?: string; // MessageId
  M?: Array<{
    H: string; // Hub
    M: string; // Method
    A: unknown[]; // Arguments
  }>;
  R?: Record<string, unknown>; // Response to invocation
  I?: string; // InvocationId
  S?: number; // Started
  G?: string; // GroupsToken
}

function decompressZlib(data: string): unknown {
  try {
    const buffer = Buffer.from(data, "base64");
    const decompressed = inflateRawSync(buffer);
    return JSON.parse(decompressed.toString());
  } catch (e) {
    console.error("[SignalR] Failed to decompress:", (e as Error).message);
    return null;
  }
}

export class F1SignalRClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private connectionToken = "";
  private cookie = "";
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  private _connected = false;

  get connected(): boolean {
    return this._connected;
  }

  async connect(): Promise<void> {
    try {
      console.log("[SignalR] Negotiating connection...");
      await this.negotiate();
      console.log("[SignalR] Opening WebSocket...");
      await this.openSocket();
    } catch (err) {
      console.error("[SignalR] Connection failed:", (err as Error).message);
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    this._connected = false;
    if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
  }

  private async negotiate(): Promise<void> {
    const connectionData = encodeURIComponent(
      JSON.stringify([{ name: HUB }])
    );
    const url = `${F1_BASE}/negotiate?connectionData=${connectionData}&clientProtocol=1.5`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "BestHTTP",
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`Negotiate failed: ${res.status} ${res.statusText}`);
    }

    // Capture the load balancer cookie
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      this.cookie = setCookie.split(";")[0];
    }

    const data = (await res.json()) as NegotiateResponse;
    this.connectionToken = data.ConnectionToken;
    console.log(
      `[SignalR] Negotiated. ConnectionId: ${data.ConnectionId}`
    );
  }

  private openSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const connectionData = encodeURIComponent(
        JSON.stringify([{ name: HUB }])
      );
      const token = encodeURIComponent(this.connectionToken);
      const url = `wss://livetiming.formula1.com/signalr/connect?clientProtocol=1.5&transport=webSockets&connectionToken=${token}&connectionData=${connectionData}`;

      const headers: Record<string, string> = {
        "User-Agent": "BestHTTP",
        "Accept-Encoding": "gzip,identity",
      };
      if (this.cookie) {
        headers["Cookie"] = this.cookie;
      }

      this.ws = new WebSocket(url, { headers });

      this.ws.on("open", () => {
        console.log("[SignalR] WebSocket connected, subscribing...");
        this._connected = true;
        this.subscribe();
        this.startKeepAlive();
        this.emit("connected");
        resolve();
      });

      this.ws.on("message", (raw: Buffer) => {
        this.handleMessage(raw.toString());
      });

      this.ws.on("close", (code, reason) => {
        console.log(
          `[SignalR] WebSocket closed: ${code} ${reason.toString()}`
        );
        this._connected = false;
        this.emit("disconnected");
        this.scheduleReconnect();
      });

      this.ws.on("error", (err) => {
        console.error("[SignalR] WebSocket error:", err.message);
        reject(err);
      });
    });
  }

  private subscribe(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const msg = JSON.stringify({
      H: HUB,
      M: "Subscribe",
      A: [TOPICS],
      I: 1,
    });

    this.ws.send(msg);
    console.log(`[SignalR] Subscribed to ${TOPICS.length} topics`);
  }

  private startKeepAlive(): void {
    if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
    // Send empty object as keep-alive every 10s
    this.keepAliveTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send("{}");
      }
    }, 10_000);
  }

  private handleMessage(raw: string): void {
    if (!raw || raw === "{}") return;

    try {
      const msg: SignalRMessage = JSON.parse(raw);

      // Initial response with full state snapshot
      if (msg.R && msg.I === "1") {
        console.log("[SignalR] Received initial state snapshot");
        for (const [topic, data] of Object.entries(msg.R)) {
          const decompressed = topic.endsWith(".z")
            ? decompressZlib(data as string)
            : data;
          if (decompressed != null) {
            this.emit("data", topic.replace(".z", ""), decompressed);
          }
        }
        return;
      }

      // Incremental updates
      if (msg.M) {
        for (const m of msg.M) {
          if (m.M === "feed" && m.A.length >= 2) {
            const topic = m.A[0] as string;
            const rawData = m.A[1];

            const decompressed = topic.endsWith(".z")
              ? decompressZlib(rawData as string)
              : rawData;

            if (decompressed != null) {
              this.emit("data", topic.replace(".z", ""), decompressed);
            }
          }
        }
      }
    } catch {
      // Ignore parse errors for keep-alive responses
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    console.log("[SignalR] Reconnecting in 5s...");
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, 5000);
  }
}
