"use client";

import { VoiceRoom } from "@/components/VoiceRoom";
import { use, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

interface RoomPageProps {
  params: Promise<{ roomId: string }>;
}

function RoomContent({ roomId }: { roomId: string }) {
  const searchParams = useSearchParams();
  const displayName = searchParams.get("name")?.trim() || "ไม่ระบุชื่อ";
  const roomName = searchParams.get("roomName")?.trim() || "";
  // useRef ensures userId never changes across re-renders
  const userIdRef = useRef<string>(`user-${uuidv4().slice(0, 6)}`);

  return <VoiceRoom roomId={roomId} userId={userIdRef.current} displayName={displayName} roomName={roomName} />;
}

export default function RoomPage({ params }: RoomPageProps) {
  const { roomId } = use(params);

  return (
    <Suspense fallback={null}>
      <RoomContent roomId={roomId} />
    </Suspense>
  );
}
