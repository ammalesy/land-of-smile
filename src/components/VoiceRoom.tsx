"use client";

import { useEffect, useState } from "react";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useDebugLog } from "@/hooks/useDebugLog";
import { ParticipantList } from "@/components/ParticipantList";
import { AudioControls } from "@/components/AudioControls";
import { ScreenShareView } from "@/components/ScreenShareView";
import { DebugPanel } from "@/components/DebugPanel";
import { ThemeBackground } from "@/components/ThemeBackground";
import { ThemeSelector } from "@/components/ThemeSelector";
import { ChatBox } from "@/components/ChatBox";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "@/context/ThemeContext";
import type { ThemeId } from "@/types";

interface VoiceRoomProps {
  roomId: string;
  userId: string;
  displayName: string;
  roomName: string;
  initialTheme?: ThemeId;
}

export function VoiceRoom({ roomId, userId, displayName, roomName, initialTheme }: VoiceRoomProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDebug = searchParams.get("debug") === "true";

  const { theme, setTheme } = useTheme();
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [themeBeforeOpen, setThemeBeforeOpen] = useState<ThemeId>("galaxy");

  // Apply creator’s initial theme immediately on mount, only once
  useEffect(() => {
    if (initialTheme) setTheme(initialTheme);
  }, []); // eslint-disable-line

  const { entries: debugEntries, addLog, clearLog } = useDebugLog();

  const {
    participants, isMuted, isSoundMuted, isConnected, audioBlocked,
    error, joinRoom, leaveRoom, toggleMute, toggleSoundMute, unlockAudio,
    isScreenSharing, remoteScreenStream, startScreenShare, stopScreenShare,
    changeRoomTheme,
  } = useWebRTC(
    roomId, userId, displayName, roomName,
    isDebug ? addLog : undefined,
    initialTheme,   // creator’s initial theme — synced into presence on join
    setTheme,       // called when a theme-change signal arrives from another user
  );

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

  const handleOpenThemeSelector = () => {
    setThemeBeforeOpen(theme);
    setShowThemeSelector(true);
  };

  const handleThemeConfirm = () => {
    changeRoomTheme(theme); // broadcast the currently-selected theme to everyone
    setShowThemeSelector(false);
  };

  const handleThemeCancel = () => {
    setTheme(themeBeforeOpen); // revert preview
    setShowThemeSelector(false);
  };

  // Find the display name of the remote sharer (if any)
  const remoteSharerName = remoteScreenStream
    ? participants.get(remoteScreenStream.peerId)?.displayName ?? remoteScreenStream.peerId
    : undefined;

  if (error) {
    return (
      <div className="relative flex min-h-screen items-center justify-center">
        <ThemeBackground />
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

      {/* ── Theme Background ─────────────────────────── */}
      <ThemeBackground />

      {/* ── In-room Theme Selector Popup ───────────── */}
      {showThemeSelector && (
        <ThemeSelector
          mode="room"
          onConfirm={handleThemeConfirm}
          onCancel={handleThemeCancel}
        />
      )}

      {/* ── Theme button — top-right corner ──────────── */}
      <div className="absolute top-5 right-5 z-20">
        <button
          onClick={handleOpenThemeSelector}
          aria-label="เปลี่ยน theme"
          title="เปลี่ยน theme ของห้อง"
          className="flex items-center gap-1.5 rounded-xl bg-[var(--t-btn-icon-bg)] hover:bg-[var(--t-btn-icon-hover-bg)] border border-[var(--t-card-border)] px-3 py-2 text-sm text-[var(--t-text-secondary)] hover:text-[var(--t-text-primary)] transition-all shadow-sm active:scale-95"
        >
          🎨 <span className="text-xs font-medium">Theme</span>
        </button>
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

      {/* ── Main content: voice card + chat side by side ── */}
      <div className="relative z-10 flex items-start gap-4 w-full max-w-3xl">

        {/* Left: voice card */}
        <div className="flex-shrink-0 w-80 space-y-6">

          {/* Header */}
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold text-[var(--t-text-primary)]">
              {roomName || "ห้องสนทนา"}
            </h1>
            <p className="text-xs text-[var(--t-text-mono)] font-mono">
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
          <div className="rounded-2xl bg-[var(--t-card-bg)] border border-[var(--t-card-border)] p-5">
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

        {/* Right: chat panel — always visible */}
        <div className="flex-1 rounded-2xl bg-[var(--t-card-bg)] border border-[var(--t-card-border)] overflow-hidden flex flex-col" style={{ height: "28rem" }}>
          <div className="px-4 py-2.5 border-b border-[var(--t-card-border)]">
            <span className="text-sm font-semibold text-[var(--t-text-primary)]">💬 Chat</span>
          </div>
          <ChatBox
            roomId={roomId}
            userId={userId}
            displayName={displayName}
          />
        </div>

      </div>

      {/* Debug panel — visible only when ?debug=true */}
      {isDebug && <DebugPanel entries={debugEntries} onClear={clearLog} />}
    </div>
  );
}
