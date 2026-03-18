import { useEffect, useRef, useState, useCallback } from "react";
import Ably from "ably";
import { ChatClient, LogLevel } from "@ably/chat";

export interface ChatMessage {
  id: string;
  clientId: string;
  displayName: string;
  text: string;
  timestamp: Date;
  isSelf: boolean;
}

export function useChat(roomId: string, userId: string, displayName: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep displayName in a ref so the send callback always uses the latest value
  const displayNameRef = useRef(displayName);
  useEffect(() => { displayNameRef.current = displayName; }, [displayName]);

  const roomRef = useRef<Awaited<ReturnType<ChatClient["rooms"]["get"]>> | null>(null);
  const chatClientRef = useRef<ChatClient | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(false);

  const sendMessage = useCallback(async (text: string) => {
    const room = roomRef.current;
    if (!room || !text.trim()) return;
    await room.messages.send({
      text: text.trim(),
      // Store the sender's display name in headers so all clients can show it
      headers: { displayName: displayNameRef.current },
    });
  }, []);

  useEffect(() => {
    // Prevent double-initialization in React Strict Mode
    if (mountedRef.current) return;
    mountedRef.current = true;

    const realtimeClient = new Ably.Realtime({
      authUrl: `/api/ably-token?clientId=${encodeURIComponent(userId)}`,
      clientId: userId,
    });

    const chatClient = new ChatClient(realtimeClient, { logLevel: LogLevel.Error });
    chatClientRef.current = chatClient;

    const setup = async () => {
      try {
        const room = await chatClient.rooms.get(roomId);
        roomRef.current = room;

        await room.attach();

        const { unsubscribe } = room.messages.subscribe((event) => {
          const msg = event.message;
          const senderDisplay =
            (msg.headers?.displayName as string | undefined) ?? msg.clientId;

          setMessages((prev) => [
            ...prev,
            {
              id: msg.serial,
              clientId: msg.clientId,
              displayName: senderDisplay,
              text: msg.text,
              timestamp: msg.timestamp,
              isSelf: msg.clientId === userId,
            },
          ]);
        });

        unsubscribeRef.current = unsubscribe;
        setIsReady(true);
      } catch (err) {
        setError((err as Error).message);
      }
    };

    setup();

    return () => {
      unsubscribeRef.current?.();
      roomRef.current?.detach().catch(() => {});
      realtimeClient.close();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { messages, sendMessage, isReady, error };
}
