"use client";

import { useEffect, useRef } from "react";

interface ScreenShareViewProps {
  /** Stream from the local screen capture (sharer's own preview) */
  localStream?: MediaStream | null;
  /** Stream received from a remote peer */
  remoteStream?: MediaStream | null;
  /** Display name of the remote sharer */
  sharerName?: string;
  /** Called when the local user wants to stop sharing */
  onStopShare?: () => void;
}

export function ScreenShareView({
  localStream,
  remoteStream,
  sharerName,
  onStopShare,
}: ScreenShareViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stream = localStream ?? remoteStream ?? null;

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  if (!stream) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative" style={{ width: "90vw" }}>
        {/* Screen label */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs text-white backdrop-blur-sm">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
          {localStream ? "คุณกำลังแชร์หน้าจอ" : `${sharerName ?? "ผู้ใช้"} กำลังแชร์หน้าจอ`}
        </div>

        {/* Video */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={!!localStream}
          className="w-full h-auto rounded-2xl bg-black"
          style={{ display: "block" }}
          aria-label={localStream ? "หน้าจอของคุณ" : `หน้าจอของ ${sharerName ?? "ผู้ใช้"}`}
        />

        {/* Stop sharing button — only for the local sharer */}
        {localStream && onStopShare && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
            <button
              onClick={onStopShare}
              aria-label="หยุดแชร์หน้าจอ"
              className="flex items-center gap-2 rounded-full bg-red-600 hover:bg-red-500 active:scale-95 transition-all px-5 py-2 text-sm text-white font-medium shadow-lg"
            >
              <span aria-hidden="true">⏹</span>
              หยุดแชร์
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
