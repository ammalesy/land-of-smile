"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { useRooms } from "@/hooks/useRooms";
import type { RoomInfo } from "@/app/api/rooms/route";

export default function Home() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const { rooms, loading, error, refresh } = useRooms();

  const hasName = displayName.trim().length > 0;

  const handleCreate = () => {
    const name = displayName.trim();
    if (!name) return;
    const newRoomId = uuidv4().slice(0, 8);
    router.push(`/room/${newRoomId}?name=${encodeURIComponent(name)}`);
  };

  const handleJoin = () => {
    const name = displayName.trim();
    if (!name || !selectedRoomId) return;
    router.push(`/room/${selectedRoomId}?name=${encodeURIComponent(name)}`);
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center p-6">

      {/* ── Galaxy Background ─────────────────────────── */}
      <div className="galaxy-bg" aria-hidden="true">
        {/* Star layers */}
        <div className="stars-layer stars-tiny" />
        <div className="stars-layer stars-medium" />
        <div className="stars-layer stars-bright" />

        {/* Shooting stars */}
        <div className="shooting-star" />
        <div className="shooting-star" />
        <div className="shooting-star" />

        {/* Black Hole — centred behind the main card */}
        <div className="black-hole" />
      </div>

      {/* Create Room — top-right corner */}
      <div className="absolute top-5 right-5 z-10">
        <button
          onClick={handleCreate}
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
          <h1 className="text-3xl font-bold text-white">Land of Smile</h1>
          <p className="text-sm text-gray-400">Group Voice Chat — รองรับสูงสุด 7 คน</p>
        </div>

        {/* Display Name */}
        <div className="space-y-2 text-left">
          <label htmlFor="displayName" className="text-xs font-medium text-gray-400 uppercase tracking-wider">
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
            className={`w-full rounded-xl bg-white/5 border px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors
              ${!hasName ? "border-red-500/50" : "border-white/10"}`}
          />
          {!hasName && (
            <p className="text-xs text-red-400">* กรุณาใส่ชื่อก่อนเข้าห้อง</p>
          )}
        </div>

        {/* Room List */}
        <div className="space-y-3 text-left">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              ห้องที่เปิดอยู่
            </span>
            <button
              onClick={refresh}
              aria-label="รีเฟรชรายการห้อง"
              className="text-xs text-gray-500 hover:text-white transition-colors flex items-center gap-1"
            >
              ↻ รีเฟรช
            </button>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex flex-col gap-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
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
            <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-6 text-center">
              <p className="text-2xl mb-2">🏜️</p>
              <p className="text-sm text-gray-400">ยังไม่มีห้องที่เปิดอยู่</p>
              <p className="text-xs text-gray-600 mt-1">กด "สร้างห้องใหม่" เพื่อเริ่มต้น</p>
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
                          : "border-white/10 bg-white/5 hover:bg-white/10"
                        }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        {/* Room ID + member count */}
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base">{isSelected ? "✅" : "🎙"}</span>
                          <span className="font-mono text-sm text-indigo-300 truncate">{room.roomId}</span>
                        </div>
                        <span className="shrink-0 text-xs text-gray-400">
                          👤 {room.memberCount}/7
                        </span>
                      </div>

                      {/* Member names */}
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {room.members.map((m, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs text-gray-300"
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
          onClick={handleJoin}
          disabled={!selectedRoomId || !hasName}
          aria-label="เข้าร่วมห้องที่เลือก"
          className="w-full rounded-2xl bg-white/10 py-4 text-base font-semibold text-white hover:bg-white/20 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {selectedRoomId ? `เข้าร่วม ${selectedRoomId} →` : "เลือกห้องเพื่อเข้าร่วม"}
        </button>

      </div>
    </div>
  );
}
