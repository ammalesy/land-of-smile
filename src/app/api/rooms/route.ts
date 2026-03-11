import { NextResponse } from "next/server";
import Ably from "ably";

export const dynamic = "force-dynamic";

export interface RoomInfo {
  roomId: string;
  roomName: string;
  memberCount: number;
  members: { displayName: string; isMuted: boolean; isScreenSharing: boolean }[];
}

export async function GET() {
  const apiKey = process.env.ABLY_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Ably API key not configured" }, { status: 500 });
  }

  const client = new Ably.Rest(apiKey);

  // List all channels that match "voice-room:*"
  // Ably returns a plain array of channel ID strings when using by=id
  const channelList = await client.request("GET", "/channels", 100, {
    prefix: "voice-room:",
    by: "id",
  });

  if (!channelList.success || !Array.isArray(channelList.items)) {
    return NextResponse.json({ rooms: [] });
  }

  const rooms: RoomInfo[] = [];

  // Fetch presence for each active channel
  await Promise.all(
    channelList.items.map(async (item: unknown) => {
      // items is an array of channel ID strings e.g. "voice-room:abc123"
      const channelId = typeof item === "string" ? item : String(item);
      if (!channelId.startsWith("voice-room:")) return;

      const roomId = channelId.replace("voice-room:", "");

      try {
        const presenceResult = await client.request(
          "GET",
          `/channels/${encodeURIComponent(channelId)}/presence`,
          100,
          {}
        );

        if (!presenceResult.success || !Array.isArray(presenceResult.items)) return;

        let roomName = "";
        const members = presenceResult.items.map((m: { data?: unknown; clientId?: string }) => {
          // data may be a JSON string or already an object depending on encoding
          let parsed: { displayName?: string; isMuted?: boolean; isScreenSharing?: boolean; roomName?: string } = {};
          try {
            parsed = typeof m.data === "string" ? JSON.parse(m.data) : (m.data as typeof parsed ?? {});
          } catch { /* use empty defaults */ }

          // Use roomName from first member that has it
          if (!roomName && parsed.roomName) roomName = parsed.roomName;

          return {
            displayName: parsed.displayName ?? m.clientId ?? "Unknown",
            isMuted: parsed.isMuted ?? false,
            isScreenSharing: parsed.isScreenSharing ?? false,
          };
        });

        if (members.length > 0) {
          rooms.push({ roomId, roomName: roomName || roomId, memberCount: members.length, members });
        }
      } catch {
        // Channel exists but presence unavailable — skip
      }
    })
  );

  // Sort by most members first
  rooms.sort((a, b) => b.memberCount - a.memberCount);

  return NextResponse.json({ rooms }, {
    headers: { "Cache-Control": "no-store" },
  });
}
