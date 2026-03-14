"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

const SHORTCUTS: Record<string, string> = {
  "g+c": "/command",
  "g+v": "/vehicles",
  "g+r": "/reports",
  "g+t": "/tenders",
  "g+m": "/maintenance",
  "g+s": "/salary/summary",
  "g+f": "/fuel/cards",
  "g+l": "/logistics/workplace",
  "g+p": "/pnl",
  "g+d": "/dispatch/new",
  "g+a": "/analytics",
  "g+g": "/geofences",
};

export function useHotkeys() {
  const router = useRouter();

  useEffect(() => {
    let pendingKey = "";
    let timer: ReturnType<typeof setTimeout>;

    const handler = (e: KeyboardEvent) => {
      // Don't trigger in inputs
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const key = e.key.toLowerCase();

      if (pendingKey) {
        const combo = `${pendingKey}+${key}`;
        const path = SHORTCUTS[combo];
        if (path) {
          e.preventDefault();
          router.push(path);
        }
        pendingKey = "";
        clearTimeout(timer);
        return;
      }

      if (key === "g") {
        pendingKey = "g";
        timer = setTimeout(() => { pendingKey = ""; }, 500);
        return;
      }

      // Escape closes modals (dispatches custom event)
      if (key === "escape") {
        window.dispatchEvent(new CustomEvent("hotkey-escape"));
      }

      // ? shows shortcuts help
      if (key === "?" && !e.shiftKey) {
        window.dispatchEvent(new CustomEvent("hotkey-help"));
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router]);
}

// Shortcuts help text
export const SHORTCUT_LIST = Object.entries(SHORTCUTS).map(([combo, path]) => ({
  keys: combo.replace("+", " → "),
  label: path.replace(/\//g, " / ").trim(),
}));
