"use client";

import { useEffect } from "react";
import { useWebRTC } from "@/hooks/useWebRTC";
import { ParticipantList } from "@/components/ParticipantList";
import { AudioControls } from "@/components/AudioControls";
import { ScreenShareView } from "@/components/ScreenShareView";
import { useRouter } from "next/navigation";

interface VoiceRoomProps {
  roomId: string;
  userId: string;
  displayName: string;
  roomName: string;
}

export function VoiceRoom({ roomId, userId, displayName, roomName }: VoiceRoomProps) {
  const router = useRouter();
  const {
    participants, isMuted, isSoundMuted, isConnected, audioBlocked,
    error, joinRoom, leaveRoom, toggleMute, toggleSoundMute, unlockAudio,
    isScreenSharing, remoteScreenStream, startScreenShare, stopScreenShare,
  } = useWebRTC(roomId, userId, displayName, roomName);

  useEffect(() => {
    joinRoom();
  }, [joinRoom]);

  const handleLeave = () => {
    leaveRoom();
    router.push("/");
  };

  const handleToggleScreenShare = () => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      startScreenShare();
    }
  };

  // Find the display name of the remote sharer (if any)
  const remoteSharerName = remoteScreenStream
    ? participants.get(remoteScreenStream.peerId)?.displayName ?? remoteScreenStream.peerId
    : undefined;

  if (error) {
    return (
      <div className="relative flex min-h-screen items-center justify-center">
        <div className="galaxy-bg" aria-hidden="true">
          <div className="stars-layer stars-tiny" />
          <div className="stars-layer stars-medium" />
          <div className="stars-layer stars-bright" />
          <div className="shooting-star" />
          <div className="shooting-star" />
          <div className="black-hole" />
        </div>
        <div className="relative z-10 rounded-2xl bg-red-900/30 border border-red-500/30 p-8 text-center max-w-md">
          <p className="text-3xl mb-3">⚠️</p>
          <p className="text-red-400 font-semibold mb-2">เกิดข้อผิดพลาด</p>
          <p className="text-sm text-red-300/70 mb-6">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="rounded-lg bg-red-600 px-5 py-2 text-sm text-white hover:bg-red-500 transition-colors"
          >
            กลับหน้าแรก
          </button>
        </div>
      </div>
    );
  }

  const hasScreenShare = isScreenSharing || !!remoteScreenStream;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center p-6">

      {/* ── Galaxy Background ─────────────────────────── */}
      <div className="galaxy-bg" aria-hidden="true">
        <div className="stars-layer stars-tiny" />
        <div className="stars-layer stars-medium" />
        <div className="stars-layer stars-bright" />
        <div className="black-hole" />
      </div>

      {/* Screen share — centered, user-resizable width */}
      {(isScreenSharing || remoteScreenStream) && (
        <div className="relative z-10 flex justify-center w-full mb-6">
          {isScreenSharing && (
            <ScreenShareView
              localStream={null}
              onStopShare={stopScreenShare}
              sharerName={displayName}
            />
          )}
          {remoteScreenStream && !isScreenSharing && (
            <ScreenShareView
              remoteStream={remoteScreenStream.stream}
              sharerName={remoteSharerName}
            />
          )}
        </div>
      )}

      {/* Main card */}
      <div className="relative z-10 w-full max-w-sm space-y-6">

        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-white">
            {roomName || "ห้องสนทนา"}
          </h1>
          <p className="text-xs text-gray-500 font-mono">
            #{roomId}
          </p>
          <div className="flex items-center justify-center gap-2 text-xs">
            <span
              className={`h-2 w-2 rounded-full ${isConnected ? "bg-green-400 animate-pulse" : "bg-yellow-400"}`}
            />
            <span className={isConnected ? "text-green-400" : "text-yellow-400"}>
              {isConnected ? "Connected" : "Connecting..."}
            </span>
          </div>
        </div>

        {/* iOS Safari audio unlock banner */}
        {audioBlocked && (
          <button
            onClick={unlockAudio}
            className="w-full rounded-2xl bg-yellow-500/20 border border-yellow-500/40 px-4 py-4 text-sm text-yellow-300 font-medium text-center active:scale-95 transition-all"
          >
            🔈 แตะที่นี่เพื่อเปิดเสียง
          </button>
        )}

        {/* Participants */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
          <ParticipantList
            participants={participants}
            localUserId={userId}
            localDisplayName={displayName}
            localIsMuted={isMuted}
            localIsScreenSharing={isScreenSharing}
          />
        </div>

        {/* Controls */}
        <AudioControls
          isMuted={isMuted}
          isSoundMuted={isSoundMuted}
          isConnected={isConnected}
          isScreenSharing={isScreenSharing}
          someoneElseIsScreenSharing={!!remoteScreenStream}
          onToggleMute={toggleMute}
          onToggleSoundMute={toggleSoundMute}
          onLeave={handleLeave}
          onToggleScreenShare={handleToggleScreenShare}
        />
      </div>
    </div>
  );
}
