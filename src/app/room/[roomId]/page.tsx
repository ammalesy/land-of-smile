"use client";

import { VoiceRoom } from "@/components/VoiceRoom";
import { use, useRef } from "react";
import { v4 as uuidv4 } from "uuid";

interface RoomPageProps {
  params: Promise<{ roomId: string }>;
}

export default function RoomPage({ params }: RoomPageProps) {
  const { roomId } = use(params);
  // useRef ensures userId never changes across re-renders
  const userIdRef = useRef<string>(`user-${uuidv4().slice(0, 6)}`);

  return <VoiceRoom roomId={roomId} userId={userIdRef.current} />;
}
