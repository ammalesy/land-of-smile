"use client";

import { Participant } from "@/types";

interface ParticipantListProps {
  participants: Map<string, Participant>;
  localUserId: string;
  localDisplayName: string;
  localIsMuted: boolean;
  localIsSoundMuted: boolean;
  localIsScreenSharing: boolean;
  peerConnectionStates?: Map<string, RTCPeerConnectionState>;
}

export function ParticipantList({ participants, localUserId, localDisplayName, localIsMuted, localIsSoundMuted, localIsScreenSharing, peerConnectionStates }: ParticipantListProps) {
  const allParticipants: Participant[] = [
    { userId: localUserId, displayName: localDisplayName, isMuted: localIsMuted, isSoundMuted: localIsSoundMuted, isSpeaking: false, isScreenSharing: localIsScreenSharing },
    ...Array.from(participants.values()),
  ];

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-[var(--t-text-secondary)] uppercase tracking-wider">
        Participants ({allParticipants.length}/7)
      </h2>
      <ul className="flex flex-col gap-2">
        {allParticipants.map((p) => (
          <li
            key={p.userId}
            className="flex items-center gap-3 rounded-xl bg-[var(--t-participant-bg)] px-4 py-3 border border-[var(--t-participant-border)]"
          >
            {/* Avatar — first 2 chars of displayName, with loading ring if connecting */}
            <div className="relative shrink-0">
              {p.userId !== localUserId && (() => {
                const connState = peerConnectionStates?.get(p.userId);
                const isConnecting = connState !== undefined && connState !== "connected" && connState !== "closed";
                return isConnecting ? (
                  <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--t-accent)] animate-spin" aria-hidden="true" />
                ) : null;
              })()}
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-500 text-white text-sm font-bold">
                {p.displayName.slice(0, 2).toUpperCase()}
              </div>
            </div>

            {/* Display name + user id */}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[var(--t-text-primary)] truncate">
                {p.userId === localUserId ? `${p.displayName} (คุณ)` : p.displayName}
              </p>
              <p className="text-[10px] text-[var(--t-text-mono)] font-mono truncate">#{p.userId}</p>
            </div>

            {/* Status icons: mic + sound */}
            <div className="flex items-center gap-1.5">
              {/* Microphone */}
              {p.isMuted ? (
                <span
                  title="ปิดไมค์"
                  className="flex items-center justify-center w-6 h-6 rounded-full bg-red-500/20 text-red-400"
                  aria-label="ไมค์ปิด"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                    <path d="M9.25 3a2.75 2.75 0 0 0-2.75 2.75v.56L14.5 14.31V10a.75.75 0 0 1 1.5 0v1.19l1.22 1.22a.75.75 0 0 1-1.06 1.06l-1.41-1.41A5.25 5.25 0 0 1 10 17a5.25 5.25 0 0 1-5.25-5.25.75.75 0 0 1 1.5 0A3.75 3.75 0 0 0 9.53 15.5l-.03-.03V5.75A2.75 2.75 0 0 0 7 7.81V10a.75.75 0 0 1-1.5 0V7.81A4.25 4.25 0 0 1 9.25 3Z" />
                    <path d="M2.22 2.22a.75.75 0 0 1 1.06 0l15 15a.75.75 0 1 1-1.06 1.06l-15-15a.75.75 0 0 1 0-1.06Z" />
                    <path d="M10.75 15.47V17.5h1.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5h1.5v-2.03Z" />
                  </svg>
                </span>
              ) : (
                <span
                  title="เปิดไมค์"
                  className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500/15 text-green-400"
                  aria-label="ไมค์เปิด"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                    <path d="M7 4a3 3 0 0 1 6 0v6a3 3 0 1 1-6 0V4Z" />
                    <path d="M5.5 9.643a.75.75 0 0 0-1.5 0V10a6 6 0 0 0 5.25 5.955V17.5h-1.5a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-1.5v-1.545A6 6 0 0 0 16 10v-.357a.75.75 0 0 0-1.5 0V10a4.5 4.5 0 0 1-9 0v-.357Z" />
                  </svg>
                </span>
              )}

              {/* Speaker / Deafen */}
              {p.isSoundMuted ? (
                <span
                  title="ปิดเสียง (Deafened)"
                  className="flex items-center justify-center w-6 h-6 rounded-full bg-red-500/20 text-red-400"
                  aria-label="เสียงปิด"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                    <path d="M9.547 3.062A.75.75 0 0 1 10 3.75v12.5a.75.75 0 0 1-1.264.546L4.703 13H3.167a.75.75 0 0 1-.7-.48A6.985 6.985 0 0 1 2 10c0-.887.165-1.737.468-2.52a.75.75 0 0 1 .699-.48h1.535l4.033-3.796a.75.75 0 0 1 .812-.142Z" />
                    <path d="M13.28 7.22a.75.75 0 1 0-1.06 1.06L13.44 9.5l-1.22 1.22a.75.75 0 1 0 1.06 1.06l1.22-1.22 1.22 1.22a.75.75 0 1 0 1.06-1.06L15.56 9.5l1.22-1.22a.75.75 0 0 0-1.06-1.06L14.5 8.44l-1.22-1.22Z" />
                  </svg>
                </span>
              ) : (
                <span
                  title="เปิดเสียง"
                  className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500/15 text-green-400"
                  aria-label="เสียงเปิด"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                    <path d="M9.547 3.062A.75.75 0 0 1 10 3.75v12.5a.75.75 0 0 1-1.264.546L4.703 13H3.167a.75.75 0 0 1-.7-.48A6.985 6.985 0 0 1 2 10c0-.887.165-1.737.468-2.52a.75.75 0 0 1 .699-.48h1.535l4.033-3.796a.75.75 0 0 1 .812-.142ZM12.53 6.22a.75.75 0 1 0-1.06 1.06 3.5 3.5 0 0 1 0 4.95.75.75 0 1 0 1.06 1.06 5 5 0 0 0 0-7.07Z" />
                    <path d="M14.47 4.28a.75.75 0 0 0-1.06 1.06 6 6 0 0 1 0 8.49.75.75 0 1 0 1.06 1.06 7.5 7.5 0 0 0 0-10.61Z" />
                  </svg>
                </span>
              )}
            </div>

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
