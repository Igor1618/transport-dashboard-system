"use client";
import { useEffect, useRef } from "react";

type SSEHandler = (data: any) => void;

interface UseSSEOptions {
  onGpsUpdate?: SSEHandler;
  onAlert?: SSEHandler;
  onTripUpdate?: SSEHandler;
  onGeofence?: SSEHandler;
  enabled?: boolean;
}

export function useSSE(options: UseSSEOptions = {}) {
  const { enabled = true } = options;
  const handlersRef = useRef(options);
  handlersRef.current = options;
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let retryCount = 0;

    function connect() {
      try {
        const source = new EventSource("/api/sse/events", { withCredentials: true });
        esRef.current = source;
        source.addEventListener("connected", () => { retryCount = 0; });
        source.addEventListener("gps_update", (e) => { try { handlersRef.current.onGpsUpdate?.(JSON.parse(e.data)); } catch {} });
        source.addEventListener("alert", (e) => { try { handlersRef.current.onAlert?.(JSON.parse(e.data)); } catch {} });
        source.addEventListener("trip_update", (e) => { try { handlersRef.current.onTripUpdate?.(JSON.parse(e.data)); } catch {} });
        source.addEventListener("geofence", (e) => { try { handlersRef.current.onGeofence?.(JSON.parse(e.data)); } catch {} });
        source.onerror = () => {
          source.close();
          esRef.current = null;
          retryCount++;
          const delay = Math.min(retryCount * 5000, 60000);
          reconnectTimer = setTimeout(connect, delay);
        };
      } catch {}
    }
    connect();
    return () => {
      esRef.current?.close();
      esRef.current = null;
      clearTimeout(reconnectTimer);
    };
  }, [enabled]);
}
