"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { useRooms } from "@/hooks/useRooms";
import { useTheme } from "@/context/ThemeContext";
import { ThemeSelector } from "@/components/ThemeSelector";
import { ThemeBackground } from "@/components/ThemeBackground";
import type { RoomInfo } from "@/app/api/rooms/route";

export default function Home() {
  const router = useRouter();
  const { theme } = useTheme();
  const [displayName, setDisplayName] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const { rooms, loading, error, refresh } = useRooms();

  // Create room modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");

  // Theme selector — holds the action to execute after theme is picked
  const [pendingAction, setPendingAction] = useState<"join" | "create" | null>(null);

  const hasName = displayName.trim().length > 0;
  const hasRoomName = newRoomName.trim().length > 0;

  const handleOpenCreateModal = () => {
    if (!hasName) return;
    setNewRoomName("");
    setShowCreateModal(true);
  };

  /** Step 1 of create: validate room name → open theme selector */
  const handleCreateNext = () => {
    if (!hasName || !hasRoomName) return;
    setShowCreateModal(false);
    setPendingAction("create");
  };

  /** Step 1 of join: validate → go directly to room (theme will be synced from Ably presence) */
  const handleJoinNext = () => {
    const name = displayName.trim();
    if (!name || !selectedRoomId) return;
    const selectedRoom = rooms.find((r) => r.roomId === selectedRoomId);
    const rName = selectedRoom?.roomName || selectedRoomId!;
    router.push(`/room/${selectedRoomId}?name=${encodeURIComponent(name)}&roomName=${encodeURIComponent(rName)}`);
  };

  /** Called when theme selector is confirmed (create flow only) */
  const handleThemeConfirm = () => {
    if (pendingAction === "create") {
      const name = displayName.trim();
      const rName = newRoomName.trim();
      const newRoomId = uuidv4().slice(0, 8);
      setPendingAction(null);
      router.push(`/room/${newRoomId}?name=${encodeURIComponent(name)}&roomName=${encodeURIComponent(rName)}&theme=${theme}`);
    }
  };

  const handleThemeCancel = () => {
    setPendingAction(null);
    // If they cancelled from the create flow, re-open the create modal
    if (pendingAction === "create") {
      setShowCreateModal(true);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center p-6">

      {/* ── Theme Background ─────────────────────────── */}
      <ThemeBackground />

      {/* ── Theme Selector Popup ──────────────────────── */}
      {pendingAction && (
        <ThemeSelector
          onConfirm={handleThemeConfirm}
          onCancel={handleThemeCancel}
        />
      )}

      {/* ── Create Room Modal ─────────────────────────── */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div className="w-full max-w-sm rounded-2xl bg-[var(--t-card-bg)] border border-[var(--t-card-border)] p-6 space-y-5 shadow-2xl backdrop-blur-md">
            <h2 id="modal-title" className="text-lg font-bold text-[var(--t-text-primary)]">🎙 สร้างห้องใหม่</h2>

            <div className="space-y-2">
              <label htmlFor="roomName" className="text-xs font-medium text-[var(--t-text-secondary)] uppercase tracking-wider">
                ชื่อห้อง
              </label>
              <input
                id="roomName"
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && hasRoomName && handleCreateNext()}
                placeholder="เช่น ห้องนั่งเล่น, Team Alpha..."
                maxLength={40}
                autoFocus
                className="w-full rounded-xl bg-[var(--t-input-bg)] border border-[var(--t-input-border)] px-4 py-3 text-sm text-[var(--t-input-text)] placeholder:text-[var(--t-input-placeholder)] focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 rounded-xl border border-[var(--t-btn-ghost-border)] py-2.5 text-sm text-[var(--t-btn-ghost-text)] hover:bg-[var(--t-btn-ghost-hover-bg)] hover:border-[var(--t-btn-ghost-hover-border)] hover:text-[var(--t-btn-ghost-hover-text)] transition-all"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleCreateNext}
                disabled={!hasRoomName}
                className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ถัดไป →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Room — top-right corner */}
      <div className="absolute top-5 right-5 z-10">
        <button
          onClick={handleOpenCreateModal}
          disabled={!hasName}
          aria-label="สร้างห้องใหม่"
          className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 active:scale-95 transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
        >
          🎙 สร้างห้องใหม่
        </button>
      </div>

      <div className="relative z-10 w-full max-w-sm space-y-8 text-center">

        {/* Logo / Title */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-[var(--t-text-primary)]">Land of Smile</h1>
          <p className="text-sm text-[var(--t-text-secondary)]">Group Voice Chat — รองรับสูงสุด 7 คน</p>
        </div>

        {/* Display Name */}
        <div className="space-y-2 text-left">
          <label htmlFor="displayName" className="text-xs font-medium text-[var(--t-text-secondary)] uppercase tracking-wider">
            ชื่อที่แสดง
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="ใส่ชื่อของคุณ..."
            aria-label="ชื่อที่แสดง"
            maxLength={30}
            required
            className="w-full rounded-xl bg-[var(--t-input-bg)] border border-[var(--t-input-border)] px-4 py-3 text-sm text-[var(--t-input-text)] placeholder:text-[var(--t-input-placeholder)] focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
          />
        </div>

        {/* Room List */}
        <div className="space-y-3 text-left">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--t-text-secondary)] uppercase tracking-wider">
              ห้องที่เปิดอยู่
            </span>
            <button
              onClick={refresh}
              aria-label="รีเฟรชรายการห้อง"
              className="text-xs text-[var(--t-text-mono)] hover:text-[var(--t-text-primary)] transition-colors flex items-center gap-1"
            >
              ↻ รีเฟรช
            </button>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex flex-col gap-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-[var(--t-room-row-bg)] border border-[var(--t-room-row-border)] animate-pulse" />
              ))}
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="rounded-xl bg-red-900/20 border border-red-500/20 px-4 py-3 text-xs text-red-400">
              {error}
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && rooms.length === 0 && (
            <div className="rounded-xl bg-[var(--t-card-bg)] border border-[var(--t-card-border)] px-4 py-6 text-center">
              <p className="text-2xl mb-2">🏜️</p>
              <p className="text-sm text-[var(--t-text-secondary)]">ยังไม่มีห้องที่เปิดอยู่</p>
              <p className="text-xs text-[var(--t-text-hint)] mt-1">กด "สร้างห้องใหม่" เพื่อเริ่มต้น</p>
            </div>
          )}

          {/* Room list */}
          {!loading && rooms.length > 0 && (
            <ul className="flex flex-col gap-2" role="listbox" aria-label="เลือกห้อง">
              {rooms.map((room: RoomInfo) => {
                const isSelected = selectedRoomId === room.roomId;
                return (
                  <li key={room.roomId}>
                    <button
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => setSelectedRoomId(isSelected ? null : room.roomId)}
                      className={`w-full text-left rounded-xl border px-4 py-3 transition-all active:scale-[0.98]
                        ${isSelected
                          ? "border-indigo-500 bg-indigo-500/15 ring-1 ring-indigo-500"
                          : "border-[var(--t-room-row-border)] bg-[var(--t-room-row-bg)] hover:bg-[var(--t-room-row-hover-bg)]"
                        }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        {/* Room name + member count */}
                        <div className="flex items-center gap-2 min-w-0">
                          {/* Radio button indicator */}
                          <span className={`shrink-0 flex items-center justify-center w-4 h-4 rounded-full border-2 transition-all
                            ${isSelected ? "border-indigo-400" : "border-[var(--t-text-mono)]"}`}>
                            {isSelected && (
                              <span className="w-2 h-2 rounded-full bg-indigo-400 block" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[var(--t-text-primary)] truncate">{room.roomName}</p>
                            <p className="text-xs text-[var(--t-text-mono)] font-mono">#{room.roomId}</p>
                          </div>
                        </div>
                        <span className="shrink-0 text-xs text-[var(--t-text-secondary)]">
                          👤 {room.memberCount}/7
                        </span>
                      </div>

                      {/* Member names */}
                      <div className="mt-1.5 flex flex-wrap justify-end gap-1">
                        {room.members.map((m, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 rounded-full bg-[var(--t-member-tag-bg)] px-2 py-0.5 text-xs text-[var(--t-member-tag-text)]"
                          >
                            {m.displayName}
                            {m.isMuted && <span title="ปิดไมค์">🔇</span>}
                            {m.isScreenSharing && <span title="กำลังแชร์จอ">🖥️</span>}
                          </span>
                        ))}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Join button */}
        <button
          onClick={handleJoinNext}
          disabled={!selectedRoomId || !hasName}
          aria-label="เข้าร่วมห้องที่เลือก"
          className="w-full rounded-2xl bg-[var(--t-join-btn-bg)] py-4 text-base font-semibold text-[var(--t-text-primary)] hover:bg-[var(--t-join-btn-hover-bg)] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {selectedRoomId
            ? `เข้าร่วม "${rooms.find((r) => r.roomId === selectedRoomId)?.roomName || selectedRoomId}" →`
            : "เลือกห้องเพื่อเข้าร่วม"}
        </button>

      </div>
    </div>
  );
}
