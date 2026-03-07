"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface DriverLocation {
  driver_number: number;
  x: number;
  y: number;
  z: number;
  date: string;
}

interface WSMessage {
  type: string;
  ts?: number;
  data?: DriverLocation[];
  sessionKey?: string;
}

const WS_URL =
  process.env.NEXT_PUBLIC_WS_RELAY_URL ||
  "wss://ws-relay-production-2cb1.up.railway.app";

export function useWebSocket(sessionKey: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const [locations, setLocations] = useState<DriverLocation[]>([]);
  const [connected, setConnected] = useState(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const sessionKeyRef = useRef(sessionKey);
  sessionKeyRef.current = sessionKey;

  const connect = useCallback(() => {
    if (!sessionKeyRef.current) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(
        JSON.stringify({
          type: "subscribe",
          sessionKey: sessionKeyRef.current,
        }),
      );
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        if (msg.type === "locations" && msg.data) {
          setLocations(msg.data);
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      // Reconnect after 2s
      reconnectTimer.current = setTimeout(connect, 2000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    if (!sessionKey) {
      // Clean up if no session
      wsRef.current?.close();
      wsRef.current = null;
      setLocations([]);
      setConnected(false);
      return;
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [sessionKey, connect]);

  // Re-subscribe when session changes while already connected
  useEffect(() => {
    if (
      connected &&
      wsRef.current?.readyState === WebSocket.OPEN &&
      sessionKey
    ) {
      wsRef.current.send(
        JSON.stringify({
          type: "subscribe",
          sessionKey,
        }),
      );
    }
  }, [sessionKey, connected]);

  return { locations, connected };
}
