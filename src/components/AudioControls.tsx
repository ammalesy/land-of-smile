"use client";

interface AudioControlsProps {
  isMuted: boolean;
  isConnected: boolean;
  onToggleMute: () => void;
  onLeave: () => void;
}

export function AudioControls({ isMuted, isConnected, onToggleMute, onLeave }: AudioControlsProps) {
  return (
    <div className="flex items-center justify-center gap-4">
      {/* Mute / Unmute */}
      <button
        onClick={onToggleMute}
        disabled={!isConnected}
        aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
        className={`flex h-14 w-14 items-center justify-center rounded-full text-xl transition-all
          ${isMuted
            ? "bg-red-500 hover:bg-red-400 text-white"
            : "bg-white/10 hover:bg-white/20 text-white"
          }
          disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        {isMuted ? "🔇" : "🎙️"}
      </button>

      {/* Leave Room */}
      <button
        onClick={onLeave}
        aria-label="Leave room"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 hover:bg-red-500 text-white text-xl transition-all"
      >
        📵
      </button>
    </div>
  );
}
