"use client";

interface AudioControlsProps {
  isMuted: boolean;
  isSoundMuted: boolean;
  isConnected: boolean;
  onToggleMute: () => void;
  onToggleSoundMute: () => void;
  onLeave: () => void;
}

export function AudioControls({
  isMuted,
  isSoundMuted,
  isConnected,
  onToggleMute,
  onToggleSoundMute,
  onLeave,
}: AudioControlsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-4">
        {/* Mute Microphone */}
        <button
          onClick={onToggleMute}
          disabled={!isConnected}
          aria-label={isMuted ? "เปิดไมค์" : "ปิดไมค์"}
          title={isMuted ? "เปิดไมค์" : "ปิดไมค์"}
          className={`flex h-14 w-14 items-center justify-center rounded-full text-xl transition-all
            ${isMuted
              ? "bg-red-500 hover:bg-red-400 text-white"
              : "bg-white/10 hover:bg-white/20 text-white"
            }
            disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {isMuted ? "🔇" : "🎙️"}
        </button>

        {/* Mute Sound (remote audio) */}
        <button
          onClick={onToggleSoundMute}
          disabled={!isConnected}
          aria-label={isSoundMuted ? "เปิดเสียง" : "ปิดเสียง"}
          title={isSoundMuted ? "เปิดเสียง" : "ปิดเสียง"}
          className={`flex h-14 w-14 items-center justify-center rounded-full text-xl transition-all
            ${isSoundMuted
              ? "bg-orange-500 hover:bg-orange-400 text-white"
              : "bg-white/10 hover:bg-white/20 text-white"
            }
            disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {isSoundMuted ? "�" : "🔊"}
        </button>

        {/* Leave Room */}
        <button
          onClick={onLeave}
          aria-label="ออกจากห้อง"
          title="ออกจากห้อง"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 hover:bg-red-500 text-white text-xl transition-all"
        >
          📵
        </button>
      </div>

      {/* Labels */}
      <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
        <span className="w-14 text-center">{isMuted ? "ไมค์ปิด" : "ไมค์เปิด"}</span>
        <span className="w-14 text-center">{isSoundMuted ? "เสียงปิด" : "เสียงเปิด"}</span>
        <span className="w-14 text-center">ออก</span>
      </div>
    </div>
  );
}
