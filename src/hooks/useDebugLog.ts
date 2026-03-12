"use client";

import { useCallback, useRef, useState } from "react";
import { DebugCategory, DebugLevel, DebugLogEntry } from "@/types";

const MAX_ENTRIES = 500;

export function useDebugLog() {
  const [entries, setEntries] = useState<DebugLogEntry[]>([]);
  const counterRef = useRef(0);

  const addLog = useCallback(
    (level: DebugLevel, category: DebugCategory, message: string) => {
      const entry: DebugLogEntry = {
        id: ++counterRef.current,
        ts: new Date(),
        level,
        category,
        message,
      };
      setEntries((prev) => {
        const next = [...prev, entry];
        return next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next;
      });
    },
    []
  );

  const clearLog = useCallback(() => setEntries([]), []);

  return { entries, addLog, clearLog };
}
