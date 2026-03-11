"use client";

import { Participant } from "@/types";

interface ParticipantListProps {
  participants: Map<string, Participant>;
  localUserId: string;
  localDisplayName: string;
  localIsMuted: boolean;
  localIsScreenSharing: boolean;
}

export function ParticipantList({ participants, localUserId, localDisplayName, localIsMuted, localIsScreenSharing }: ParticipantListProps) {
  const allParticipants: Participant[] = [
    { userId: localUserId, displayName: localDisplayName, isMuted: localIsMuted, isSpeaking: false, isScreenSharing: localIsScreenSharing },
    ...Array.from(participants.values()),
  ];

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
        Participants ({allParticipants.length}/7)
      </h2>
      <ul className="flex flex-col gap-2">
        {allParticipants.map((p) => (
          <li
            key={p.userId}
            className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3 border border-white/10"
          >
            {/* Avatar — first 2 chars of displayName */}
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-500 text-white text-sm font-bold shrink-0">
              {p.displayName.slice(0, 2).toUpperCase()}
            </div>

            {/* Display name */}
            <span className="flex-1 text-sm text-white truncate">
              {p.userId === localUserId ? `${p.displayName} (คุณ)` : p.displayName}
            </span>

            {/* Mute indicator */}
            {p.isMuted ? (
              <span title="ปิดไมค์" className="text-red-400 text-xs">🔇</span>
            ) : (
              <span title="เปิดไมค์" className="text-green-400 text-xs">🎙️</span>
            )}

            {/* Screen share indicator */}
            {p.isScreenSharing && (
              <span title="กำลังแชร์หน้าจอ" className="text-indigo-400 text-xs">🖥️</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
