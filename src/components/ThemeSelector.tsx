"use client";

import { useTheme } from "@/context/ThemeContext";
import { THEMES, getTheme } from "@/lib/themes";
import type { ThemeId } from "@/types";

interface ThemeSelectorProps {
  /** 'join' (default) = shown before entering a room; 'room' = shown inside a room */
  mode?: "join" | "room";
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modal popup that lets the user pick a theme before entering a room.
 */
export function ThemeSelector({ mode = "join", onConfirm, onCancel }: ThemeSelectorProps) {
  const { theme, setTheme } = useTheme();

  const isRoomMode = mode === "room";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="theme-modal-title"
    >
      <div className="w-full max-w-sm rounded-2xl bg-[var(--t-card-bg)] border border-[var(--t-card-border)] p-6 space-y-5 shadow-2xl backdrop-blur-md">
        {/* Header */}
        <div className="space-y-1">
          <h2 id="theme-modal-title" className="text-lg font-bold text-[var(--t-text-primary)]">
            🎨 {isRoomMode ? "เปลี่ยน Theme" : "เลือก Theme"}
          </h2>
          <p className="text-xs text-[var(--t-text-secondary)]">
            {isRoomMode
              ? "ทุกคนในห้องจะเห็น theme เดียวกันทันที"
              : "ปรับแต่ง theme ของห้องก่อนเข้าร่วม"}
          </p>
        </div>

        {/* Theme grid */}
        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="เลือก theme">
          {THEMES.map((t) => {
            const isSelected = theme === t.id;
            return (
              <button
                key={t.id}
                role="radio"
                aria-checked={isSelected}
                onClick={() => setTheme(t.id as ThemeId)}
                className={`relative rounded-xl border p-3 text-left transition-all active:scale-95
                  ${isSelected
                    ? "border-indigo-500 ring-1 ring-indigo-500 bg-indigo-500/10"
                    : "border-[var(--t-room-row-border)] bg-[var(--t-room-row-bg)] hover:bg-[var(--t-room-row-hover-bg)]"
                  }`}
              >
                {/* Swatch */}
                <div
                  className="w-full h-12 rounded-lg mb-2.5"
                  style={{ background: t.preview }}
                  aria-hidden="true"
                />

                {/* Selected indicator */}
                {isSelected && (
                  <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-bold text-white">
                    ✓
                  </span>
                )}

                <p className="text-xs font-semibold text-[var(--t-text-primary)] leading-tight">
                  {t.emoji} {t.name}
                </p>
                <p className="text-[10px] text-[var(--t-text-secondary)] mt-0.5 leading-tight">{t.description}</p>
              </button>
            );
          })}
        </div>

        {/* Current selection label */}
        <p className="text-center text-xs text-[var(--t-text-secondary)]">
          เลือกอยู่:{" "}
          <span className="text-indigo-400 font-semibold">
            {getTheme(theme).emoji} {getTheme(theme).name}
          </span>
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-[var(--t-btn-ghost-border)] py-2.5 text-sm text-[var(--t-btn-ghost-text)] hover:bg-[var(--t-btn-ghost-hover-bg)] hover:border-[var(--t-btn-ghost-hover-border)] hover:text-[var(--t-btn-ghost-hover-text)] transition-all"
          >
            ยกเลิก
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 active:scale-95 transition-all"
          >
            {isRoomMode ? "เปลี่ยน theme" : "เข้าร่วม →"}
          </button>
        </div>
      </div>
    </div>
  );
}
