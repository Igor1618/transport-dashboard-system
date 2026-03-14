'use client';

import { useEffect } from 'react';

export function ErrorTracker() {
  useEffect(() => {
    const send = (message: string, url?: string, line?: number, col?: number, stack?: string) => {
      try {
        fetch('/api/errors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message, url, line, col, stack,
            user_agent: navigator.userAgent,
          }),
        }).catch(() => {});
      } catch {}
    };

    window.onerror = (message, source, lineno, colno, error) => {
      send(String(message), source as string, lineno, colno, error?.stack);
    };

    window.onunhandledrejection = (event) => {
      const msg = event.reason?.message || event.reason?.toString() || 'Unhandled rejection';
      send(msg, window.location.href, undefined, undefined, event.reason?.stack);
    };

    return () => {
      window.onerror = null;
      window.onunhandledrejection = null;
    };
  }, []);

  return null;
}
