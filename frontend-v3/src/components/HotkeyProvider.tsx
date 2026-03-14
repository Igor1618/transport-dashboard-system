"use client";
import { useHotkeys } from "@/shared/hooks/useHotkeys";
export default function HotkeyProvider({ children }: { children: React.ReactNode }) {
  useHotkeys();
  return <>{children}</>;
}
