"use client";
import { useEffect, useRef, useCallback } from "react";

/**
 * Safe polling hook:
 * - cleanup on unmount
 * - stops on 403 (resumes on role-switch)
 * - configurable interval
 */
export function usePolling(
  fn: () => Promise<void>,
  intervalMs: number,
  deps: any[] = []
) {
  const stopped = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const wrappedFn = useCallback(async () => {
    if (stopped.current) return;
    try {
      await fn();
    } catch (e: any) {
      if (e?.status === 403 || e?.message === "POLLING_STOP_403") {
        stopped.current = true;
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fn]);

  useEffect(() => {
    stopped.current = false;
    wrappedFn();
    timerRef.current = setInterval(wrappedFn, intervalMs);

    const onRoleSwitch = () => {
      stopped.current = false;
      if (!timerRef.current) {
        wrappedFn();
        timerRef.current = setInterval(wrappedFn, intervalMs);
      }
    };
    window.addEventListener("role-switch", onRoleSwitch);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      window.removeEventListener("role-switch", onRoleSwitch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrappedFn, intervalMs, ...deps]);
}
