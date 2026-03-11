"use client";

import { useEffect, useRef, useState, useCallback } from "react";

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

const MIN_WIDTH_VW = 30;
const MAX_WIDTH_VW = 98;
const DEFAULT_WIDTH_VW = 90;

export function ScreenShareView({
  localStream,
  remoteStream,
  sharerName,
  onStopShare,
}: ScreenShareViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [widthVw, setWidthVw] = useState(DEFAULT_WIDTH_VW);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidthPx = useRef(0);

  const stream = localStream ?? remoteStream ?? null;

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // ── Resize handlers ──────────────────────────────────────────────────────

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    isDragging.current = true;
    startX.current = e.clientX;
    startWidthPx.current = containerRef.current?.offsetWidth ?? 0;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const dx = e.clientX - startX.current;
    const newPx = startWidthPx.current + dx;
    const newVw = (newPx / window.innerWidth) * 100;
    setWidthVw(Math.min(MAX_WIDTH_VW, Math.max(MIN_WIDTH_VW, newVw)));
  }, []);

  const onPointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  if (!stream) return null;

  return (
    <div
      ref={containerRef}
      className="relative rounded-2xl overflow-visible border border-white/10 bg-black"
      style={{ width: `${widthVw}vw` }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Screen label */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs text-white backdrop-blur-sm">
        <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
        {localStream ? "คุณกำลังแชร์หน้าจอ" : `${sharerName ?? "ผู้ใช้"} กำลังแชร์หน้าจอ`}
      </div>

      {/* Width indicator — shown while dragging */}
      <div
        className={`absolute top-3 right-14 z-10 rounded-full bg-black/60 px-2 py-1 text-xs text-white/70 backdrop-blur-sm transition-opacity ${isDragging.current ? "opacity-100" : "opacity-0"}`}
        aria-hidden="true"
      >
        {Math.round(widthVw)}vw
      </div>

      {/* Video — height follows aspect ratio automatically */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={!!localStream}
        className="w-full h-auto block bg-black rounded-2xl"
        aria-label={localStream ? "หน้าจอของคุณ" : `หน้าจอของ ${sharerName ?? "ผู้ใช้"}`}
      />

      {/* Stop sharing button */}
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

      {/* Resize handle — right edge */}
      <div
        role="separator"
        aria-label="ปรับความกว้าง"
        aria-orientation="vertical"
        onPointerDown={onPointerDown}
        className="absolute top-0 right-0 h-full w-3 cursor-ew-resize z-20 flex items-center justify-center group"
      >
        {/* Visual grip */}
        <div className="h-12 w-1 rounded-full bg-white/20 group-hover:bg-white/60 group-active:bg-white/80 transition-colors" />
      </div>
    </div>
  );
}
