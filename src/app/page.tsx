"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

export default function Home() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [roomInput, setRoomInput] = useState("");

  const handleCreate = () => {
    const name = displayName.trim();
    if (!name) return;
    const newRoomId = uuidv4().slice(0, 8);
    router.push(`/room/${newRoomId}?name=${encodeURIComponent(name)}`);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = roomInput.trim();
    const name = displayName.trim();
    if (!trimmed || !name) return;
    router.push(`/room/${trimmed}?name=${encodeURIComponent(name)}`);
  };

  const hasName = displayName.trim().length > 0;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gray-950 p-6">

      {/* Create Room — top-right corner */}
      <div className="absolute top-5 right-5">
        <button
          onClick={handleCreate}
          disabled={!hasName}
          aria-label="สร้างห้องใหม่"
          className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 active:scale-95 transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
        >
          🎙 สร้างห้องใหม่
        </button>
      </div>

      <div className="w-full max-w-sm space-y-8 text-center">

        {/* Logo / Title */}
        <div className="space-y-2">
          <p className="text-5xl">😊</p>
          <h1 className="text-3xl font-bold text-white">Land of Smile</h1>
          <p className="text-sm text-gray-400">Group Voice Chat — รองรับสูงสุด 7 คน</p>
        </div>

        {/* Display Name — shared for both create and join */}
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

        {/* Join Room */}
        <form onSubmit={handleJoin} className="space-y-3">
          <input
            type="text"
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value)}
            placeholder="ใส่ Room ID..."
            aria-label="Room ID"
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={!roomInput.trim() || !hasName}
            className="w-full rounded-2xl bg-white/10 py-4 text-base font-semibold text-white hover:bg-white/20 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            เข้าร่วมห้อง →
          </button>
        </form>
      </div>
    </div>
  );
}
