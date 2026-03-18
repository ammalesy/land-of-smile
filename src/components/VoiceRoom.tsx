"use client";

import { useEffect, useRef, useState } from "react";
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
import { playMessageSound } from "@/lib/notificationSound";

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

  // ── Unread message badge ──────────────────────────────────────
  const [unreadCount, setUnreadCount] = useState(0);
  const originalTitleRef = useRef<string>("");

  // Save original title on mount
  useEffect(() => {
    originalTitleRef.current = document.title;
  }, []);

  // Sync document.title with unread count
  useEffect(() => {
    if (unreadCount > 0) {
      document.title = `(${unreadCount}) ${roomName || "ห้องสนทนา"}`;
    } else {
      document.title = originalTitleRef.current;
    }
  }, [unreadCount, roomName]);

  // Reset unread when tab becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) setUnreadCount(0);
    };
    const handleFocus = () => setUnreadCount(0);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const handleNewMessage = () => {
    // Only bump unread count when the tab is not visible or not focused
    if (document.hidden || !document.hasFocus()) {
      setUnreadCount((n) => n + 1);
      playMessageSound();
    }
  };

  const handleChatRead = () => setUnreadCount(0);

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
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-6 pt-16 md:p-6">

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

      {/* ── Top-right: theme button ──────────────── */}
      <div className="absolute top-4 right-4 md:top-5 md:right-5 z-20">
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
        <div className="relative z-10 flex justify-center w-full mb-4 md:mb-6">
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
      <div className="relative z-10 flex flex-col items-center gap-4 w-full max-w-3xl">

        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-xl md:text-2xl font-bold text-[var(--t-text-primary)]">
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

        {/* Row: chat (left, wider) + participants (right, smaller) */}
        <div className="flex flex-col md:flex-row items-stretch md:items-start justify-center gap-4 w-full">

        {/* Left: chat panel — always visible */}
        <div className="relative order-2 md:order-1 w-full md:w-96 md:flex-shrink-0">
          {/* Corner badge — top-left of the chat box */}
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute -top-2 -left-2 z-10 inline-flex items-center justify-center min-w-[1.35rem] h-[1.35rem] px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none shadow-lg ring-2 ring-[var(--t-card-bg)] animate-bounce"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        <div
          className="rounded-2xl bg-[var(--t-card-bg)] border border-[var(--t-card-border)] overflow-hidden flex flex-col h-64 sm:h-80 md:h-[28rem]"
          onClick={handleChatRead}
        >
          <div className="px-4 py-2.5 border-b border-[var(--t-card-border)] flex items-center">
            <span className="text-sm font-semibold text-[var(--t-text-primary)]">💬 Chat</span>
          </div>
          <ChatBox
            roomId={roomId}
            userId={userId}
            displayName={displayName}
            onNewMessage={handleNewMessage}
          />
        </div>
        </div>

        {/* Right: voice card */}
        <div className="order-1 md:order-2 w-full md:flex-shrink-0 md:w-80 flex flex-col gap-4">

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
          <div className="rounded-2xl bg-[var(--t-card-bg)] border border-[var(--t-card-border)] p-4">
            <ParticipantList
              participants={participants}
              localUserId={userId}
              localDisplayName={displayName}
              localIsMuted={isMuted}
              localIsSoundMuted={isSoundMuted}
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

      </div>

      {/* Debug panel — visible only when ?debug=true */}
      {isDebug && <DebugPanel entries={debugEntries} onClear={clearLog} />}
    </div>
  );
}
