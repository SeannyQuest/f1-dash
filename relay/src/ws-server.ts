import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { StateManager } from "./state-manager.js";

interface ClientMessage {
  type: "subscribe" | "unsubscribe" | "ping";
}

export class BroadcastServer {
  private wss: WebSocketServer;
  private stateManager: StateManager;
  private broadcastTimer: ReturnType<typeof setInterval> | null = null;
  private clients = new Set<WebSocket>();

  constructor(port: number, stateManager: StateManager) {
    this.stateManager = stateManager;

    this.wss = new WebSocketServer({ port });

    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
      console.log(`[WS] Client connected from ${ip}. Total: ${this.clients.size + 1}`);
      this.clients.add(ws);

      // Send current state immediately on connect
      if (this.stateManager.hasData()) {
        this.sendState(ws);
      }

      ws.on("message", (raw) => {
        try {
          const msg: ClientMessage = JSON.parse(raw.toString());
          if (msg.type === "ping") {
            ws.send(JSON.stringify({ type: "pong", ts: Date.now() }));
          }
        } catch {
          // ignore
        }
      });

      ws.on("close", () => {
        this.clients.delete(ws);
        console.log(`[WS] Client disconnected. Total: ${this.clients.size}`);
      });

      ws.on("error", () => {
        this.clients.delete(ws);
      });
    });

    console.log(`[WS] Broadcast server listening on port ${port}`);
  }

  /**
   * Start broadcasting state to all clients at the given interval.
   */
  startBroadcasting(intervalMs: number = 1000): void {
    if (this.broadcastTimer) clearInterval(this.broadcastTimer);

    this.broadcastTimer = setInterval(() => {
      if (this.clients.size === 0) return;
      if (!this.stateManager.hasData()) return;

      const payload = JSON.stringify({
        type: "state",
        data: this.stateManager.getState(),
        ts: Date.now(),
      });

      for (const client of this.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      }
    }, intervalMs);

    console.log(`[WS] Broadcasting every ${intervalMs}ms`);
  }

  /**
   * Send a one-off status message to all clients.
   */
  broadcastStatus(status: string): void {
    const payload = JSON.stringify({ type: "status", status, ts: Date.now() });
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  private sendState(ws: WebSocket): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(
      JSON.stringify({
        type: "state",
        data: this.stateManager.getState(),
        ts: Date.now(),
      })
    );
  }

  getClientCount(): number {
    return this.clients.size;
  }

  close(): void {
    if (this.broadcastTimer) clearInterval(this.broadcastTimer);
    this.wss.close();
  }
}
