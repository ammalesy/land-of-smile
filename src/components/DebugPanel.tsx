"use client";

import { useEffect, useRef, useState } from "react";
import { DebugCategory, DebugLevel, DebugLogEntry } from "@/types";

interface DebugPanelProps {
  entries: DebugLogEntry[];
  onClear: () => void;
}

const LEVEL_STYLE: Record<DebugLevel, string> = {
  info:    "text-blue-300",
  success: "text-green-400",
  warn:    "text-yellow-400",
  error:   "text-red-400",
};

const LEVEL_BADGE: Record<DebugLevel, string> = {
  info:    "bg-blue-900/60 text-blue-300 border-blue-700/50",
  success: "bg-green-900/60 text-green-300 border-green-700/50",
  warn:    "bg-yellow-900/60 text-yellow-300 border-yellow-700/50",
  error:   "bg-red-900/60 text-red-300 border-red-700/50",
};

const CATEGORY_BADGE: Record<DebugCategory, string> = {
  ably:     "bg-purple-900/60 text-purple-300 border-purple-700/50",
  presence: "bg-indigo-900/60 text-indigo-300 border-indigo-700/50",
  signal:   "bg-cyan-900/60 text-cyan-300 border-cyan-700/50",
  ice:      "bg-orange-900/60 text-orange-300 border-orange-700/50",
  webrtc:   "bg-teal-900/60 text-teal-300 border-teal-700/50",
  audio:    "bg-pink-900/60 text-pink-300 border-pink-700/50",
  screen:   "bg-lime-900/60 text-lime-300 border-lime-700/50",
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function fmtTime(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, "0")}`;
}

const ALL_LEVELS: DebugLevel[] = ["info", "success", "warn", "error"];
const ALL_CATEGORIES: DebugCategory[] = ["ably", "presence", "signal", "ice", "webrtc", "audio", "screen"];

export function DebugPanel({ entries, onClear }: DebugPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filterLevels, setFilterLevels] = useState<Set<DebugLevel>>(new Set(ALL_LEVELS));
  const [filterCategories, setFilterCategories] = useState<Set<DebugCategory>>(new Set(ALL_CATEGORIES));
  const [isMinimized, setIsMinimized] = useState(false);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [entries, autoScroll]);

  const toggleLevel = (l: DebugLevel) => {
    setFilterLevels((prev) => {
      const next = new Set(prev);
      next.has(l) ? next.delete(l) : next.add(l);
      return next;
    });
  };

  const toggleCategory = (c: DebugCategory) => {
    setFilterCategories((prev) => {
      const next = new Set(prev);
      next.has(c) ? next.delete(c) : next.add(c);
      return next;
    });
  };

  const filtered = entries.filter(
    (e) => filterLevels.has(e.level) && filterCategories.has(e.category)
  );

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex flex-col"
      style={{ maxHeight: isMinimized ? "2.5rem" : "40vh" }}
    >
      {/* Header bar */}
      <div className="flex items-center gap-2 bg-gray-950/95 border-t border-white/10 px-3 py-1.5 text-[11px] font-mono shrink-0">
        <span className="text-yellow-400 font-bold mr-1">🐛 DEBUG</span>
        <span className="text-gray-500">{entries.length} events</span>

        {/* Level filters */}
        <div className="flex gap-1 ml-2">
          {ALL_LEVELS.map((l) => (
            <button
              key={l}
              onClick={() => toggleLevel(l)}
              className={`px-1.5 py-0.5 rounded border text-[10px] transition-opacity ${LEVEL_BADGE[l]} ${filterLevels.has(l) ? "opacity-100" : "opacity-30"}`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Category filters */}
        <div className="flex gap-1 ml-1">
          {ALL_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => toggleCategory(c)}
              className={`px-1.5 py-0.5 rounded border text-[10px] transition-opacity ${CATEGORY_BADGE[c]} ${filterCategories.has(c) ? "opacity-100" : "opacity-30"}`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Auto-scroll toggle */}
          <button
            onClick={() => setAutoScroll((v) => !v)}
            className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${autoScroll ? "border-green-700/50 text-green-400" : "border-gray-700 text-gray-500"}`}
          >
            ↓ auto
          </button>
          {/* Clear */}
          <button
            onClick={onClear}
            className="text-[10px] px-1.5 py-0.5 rounded border border-gray-700 text-gray-400 hover:text-red-400 hover:border-red-700/50 transition-colors"
          >
            clear
          </button>
          {/* Minimize */}
          <button
            onClick={() => setIsMinimized((v) => !v)}
            className="text-[10px] px-1.5 py-0.5 rounded border border-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            {isMinimized ? "▲" : "▼"}
          </button>
        </div>
      </div>

      {/* Log entries */}
      {!isMinimized && (
        <div
          className="flex-1 overflow-y-auto bg-gray-950/95 border-t border-white/5"
          onScroll={(e) => {
            const el = e.currentTarget;
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
            setAutoScroll(atBottom);
          }}
        >
          {filtered.length === 0 && (
            <p className="text-center text-gray-600 text-[11px] py-4 font-mono">— no events yet —</p>
          )}
          {filtered.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-2 px-3 py-0.5 hover:bg-white/5 font-mono text-[11px] border-b border-white/5"
            >
              {/* Timestamp */}
              <span className="text-gray-600 shrink-0 w-[90px]">{fmtTime(entry.ts)}</span>

              {/* Level badge */}
              <span className={`shrink-0 px-1 rounded border text-[9px] leading-4 ${LEVEL_BADGE[entry.level]}`}>
                {entry.level.toUpperCase()}
              </span>

              {/* Category badge */}
              <span className={`shrink-0 px-1 rounded border text-[9px] leading-4 w-[54px] text-center ${CATEGORY_BADGE[entry.category]}`}>
                {entry.category}
              </span>

              {/* Message */}
              <span className={`break-all ${LEVEL_STYLE[entry.level]}`}>{entry.message}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
