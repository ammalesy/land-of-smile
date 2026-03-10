"use client";

import { Participant } from "@/types";

interface ParticipantListProps {
  participants: Map<string, Participant>;
  localUserId: string;
  localIsMuted: boolean;
}

export function ParticipantList({ participants, localUserId, localIsMuted }: ParticipantListProps) {
  const allParticipants: Participant[] = [
    { userId: localUserId, isMuted: localIsMuted, isSpeaking: false },
    ...Array.from(participants.values()),
  ];

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
        Participants ({allParticipants.length}/5)
      </h2>
      <ul className="flex flex-col gap-2">
        {allParticipants.map((p) => (
          <li
            key={p.userId}
            className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3 border border-white/10"
          >
            {/* Avatar */}
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-500 text-white text-sm font-bold shrink-0">
              {p.userId.slice(0, 2).toUpperCase()}
            </div>

            {/* Name */}
            <span className="flex-1 text-sm text-white truncate">
              {p.userId === localUserId ? `${p.userId} (You)` : p.userId}
            </span>

            {/* Mute indicator */}
            {p.isMuted ? (
              <span title="Muted" className="text-red-400 text-xs">🔇</span>
            ) : (
              <span title="Unmuted" className="text-green-400 text-xs">🎙️</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
