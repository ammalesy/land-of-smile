"use client";

import { VoiceRoom } from "@/components/VoiceRoom";
import { use } from "react";
import { v4 as uuidv4 } from "uuid";
import { useMemo } from "react";

interface RoomPageProps {
  params: Promise<{ roomId: string }>;
}

export default function RoomPage({ params }: RoomPageProps) {
  const { roomId } = use(params);
  const userId = useMemo(() => `user-${uuidv4().slice(0, 6)}`, []);

  return <VoiceRoom roomId={roomId} userId={userId} />;
}
