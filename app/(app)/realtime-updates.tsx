"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function RealtimeUpdates() {
  const router = useRouter();
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connection = useRef<WebSocket | null>(null);
  const attempts = useRef(0);
  const stopped = useRef(false);

  useEffect(() => {
    stopped.current = false;

    const connect = () => {
      if (stopped.current) return;
      const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(`${scheme}//${window.location.host}/_dtr/realtime`);
      connection.current = socket;

      socket.onopen = () => {
        attempts.current = 0;
      };
      socket.onmessage = (event) => {
        try {
          const message: unknown = JSON.parse(String(event.data));
          if (message && typeof message === "object" && "type" in message && message.type === "refresh") {
            if (refreshTimer.current) clearTimeout(refreshTimer.current);
            refreshTimer.current = setTimeout(() => router.refresh(), 100);
          }
        } catch (error) {
          console.error("Invalid realtime message:", error);
        }
      };
      socket.onclose = (event) => {
        if (stopped.current) return;
        connection.current = null;
        if (event.code === 4001) {
          router.refresh();
          return;
        }
        attempts.current += 1;
        const delay = Math.min(30_000, 1_000 * (2 ** Math.min(attempts.current - 1, 5)));
        retryTimer.current = setTimeout(connect, delay);
      };
      socket.onerror = () => {
        socket.close();
      };
    };

    connect();
    return () => {
      stopped.current = true;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      connection.current?.close();
    };
  }, [router]);

  return null;
}
