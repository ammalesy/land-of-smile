"use client";

import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { useChat } from "@/hooks/useChat";

interface ChatBoxProps {
  roomId: string;
  userId: string;
  displayName: string;
  /** Called when a message from another user arrives — used for unread badge */
  onNewMessage?: () => void;
}

export function ChatBox({ roomId, userId, displayName, onNewMessage }: ChatBoxProps) {
  const { messages, sendMessage, isReady } = useChat(roomId, userId, displayName);
  const onNewMessageRef = useRef(onNewMessage);
  useEffect(() => { onNewMessageRef.current = onNewMessage; }, [onNewMessage]);

  // Notify parent about incoming messages from others
  const prevCountRef = useRef(0);
  useEffect(() => {
    if (messages.length > prevCountRef.current) {
      const newMsgs = messages.slice(prevCountRef.current);
      const hasOthers = newMsgs.some((m) => !m.isSelf);
      if (hasOthers) onNewMessageRef.current?.();
    }
    prevCountRef.current = messages.length;
  }, [messages]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || !isReady || isSending) return;

    setIsSending(true);
    setInputValue("");
    try {
      await sendMessage(text);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── Message list ──────────────────────────────── */}
      <div className="flex-1 overflow-y-auto space-y-2 p-4 min-h-0">
        {!isReady && (
          <p className="text-center text-xs text-[var(--t-text-secondary)] animate-pulse py-4">
            กำลังเชื่อมต่อ chat...
          </p>
        )}

        {isReady && messages.length === 0 && (
          <p className="text-center text-xs text-[var(--t-text-secondary)] py-4">
            ยังไม่มีข้อความ เริ่มสนทนาได้เลย 💬
          </p>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col gap-0.5 ${msg.isSelf ? "items-end" : "items-start"}`}
          >
            {/* Sender name (only for others) */}
            {!msg.isSelf && (
              <span className="text-[10px] text-[var(--t-text-secondary)] px-1">
                {msg.displayName}
              </span>
            )}

            {/* Bubble */}
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-snug break-words ${
                msg.isSelf
                  ? "bg-[var(--t-accent)] text-white rounded-br-sm"
                  : "bg-[var(--t-card-border)]/30 text-[var(--t-text-primary)] border border-[var(--t-card-border)] rounded-bl-sm"
              }`}
            >
              {msg.text}
            </div>

            {/* Timestamp */}
            <span className="text-[10px] text-[var(--t-text-secondary)] px-1">
              {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        ))}

        {/* Invisible anchor for auto-scroll */}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input area ────────────────────────────────── */}
      <div className="px-3 pb-3 pt-2 border-t border-[var(--t-card-border)]">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!isReady || isSending}
            placeholder={isReady ? "พิมพ์ข้อความ..." : "กำลังเชื่อมต่อ..."}
            aria-label="พิมพ์ข้อความ"
            className="flex-1 rounded-xl bg-[var(--t-btn-icon-bg)] border border-[var(--t-card-border)] px-3 py-2 text-sm text-[var(--t-text-primary)] placeholder-[var(--t-text-secondary)] focus:outline-none focus:border-[var(--t-accent)] transition-colors disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!isReady || !inputValue.trim() || isSending}
            aria-label="ส่งข้อความ"
            className="flex-shrink-0 rounded-xl bg-[var(--t-accent)] hover:opacity-90 disabled:opacity-40 px-3 py-2 text-sm text-white transition-all active:scale-95 disabled:cursor-not-allowed"
          >
            ส่ง
          </button>
        </div>
      </div>
    </div>
  );
}
