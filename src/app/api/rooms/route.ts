import { NextResponse } from "next/server";
import Ably from "ably";

export const dynamic = "force-dynamic";

export interface RoomInfo {
  roomId: string;
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
  const channelList = await client.request("GET", "/channels", 100, {
    prefix: "voice-room:",
    by: "id",
  });

  if (!channelList.success) {
    return NextResponse.json({ rooms: [] });
  }

  const rooms: RoomInfo[] = [];

  // Fetch presence for each active channel
  await Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    channelList.items.map(async (ch: any) => {
      const channelId: string = ch.channelId ?? ch.id ?? "";
      if (!channelId.startsWith("voice-room:")) return;

      const roomId = channelId.replace("voice-room:", "");

      try {
        const presenceResult = await client.request("GET", `/channels/${encodeURIComponent(channelId)}/presence`, 100, {});

        if (!presenceResult.success) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const members = presenceResult.items.map((m: any) => ({
          displayName: m.data?.displayName ?? m.clientId ?? "Unknown",
          isMuted: m.data?.isMuted ?? false,
          isScreenSharing: m.data?.isScreenSharing ?? false,
        }));

        if (members.length > 0) {
          rooms.push({ roomId, memberCount: members.length, members });
        }
      } catch {
        // Channel exists but no presence — skip
      }
    })
  );

  // Sort by most members first
  rooms.sort((a, b) => b.memberCount - a.memberCount);

  return NextResponse.json({ rooms }, {
    headers: { "Cache-Control": "no-store" },
  });
}
