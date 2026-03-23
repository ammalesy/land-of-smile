import { NextResponse } from "next/server";
import Ably from "ably";

export const dynamic = "force-dynamic";

interface RoomInfo {
  roomId: string;
  roomName: string;
  memberCount: number;
  createdAt: number; // epoch ms of earliest presence entry = room creation time
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function fetchRooms(): Promise<RoomInfo[]> {
  const apiKey = process.env.ABLY_API_KEY;
  if (!apiKey) throw new Error("Ably API key not configured");

  const client = new Ably.Rest(apiKey);

  const channelList = await client.request("GET", "/channels", 100, {
    prefix: "voice-room:",
    by: "id",
  });

  if (!channelList.success || !Array.isArray(channelList.items)) return [];

  const rooms: RoomInfo[] = [];

  await Promise.all(
    channelList.items.map(async (item: unknown) => {
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
        if (presenceResult.items.length === 0) return;

        // Extract roomName and earliest timestamp from presence entries
        let roomName = "";
        let earliestTs = Date.now();
        for (const m of presenceResult.items as { data?: unknown; timestamp?: number }[]) {
          // Track the earliest join time → room creation time
          if (typeof m.timestamp === "number" && m.timestamp < earliestTs) {
            earliestTs = m.timestamp;
          }
          try {
            const parsed =
              typeof m.data === "string"
                ? JSON.parse(m.data)
                : (m.data as { roomName?: string } ?? {});
            if (parsed?.roomName && !roomName) roomName = parsed.roomName;
          } catch { /* skip */ }
        }

        rooms.push({
          roomId,
          roomName: roomName || roomId,
          memberCount: presenceResult.items.length,
          createdAt: earliestTs,
        });
      } catch {
        // Channel exists but presence unavailable — skip
      }
    })
  );

  // Sort by createdAt descending → most recently created room first
  rooms.sort((a, b) => b.createdAt - a.createdAt);
  return rooms;
}

export async function GET(request: Request) {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ??
    (() => {
      const { origin } = new URL(request.url);
      return origin;
    })();

  let rooms: RoomInfo[] = [];
  let fetchError = false;

  try {
    rooms = await fetchRooms();
    rooms = rooms.slice(0, 1); // show only the latest/top room
  } catch {
    fetchError = true;
  }

  const now = new Date();
  const buildDate = now.toUTCString();

  const items = fetchError
    ? `<item>
        <title>Error fetching rooms</title>
        <description>Could not retrieve room list at this time.</description>
        <pubDate>${buildDate}</pubDate>
      </item>`
    : rooms.length === 0
    ? `<item>
        <title>No active rooms</title>
        <description>There are currently no open rooms. Create one to get started!</description>
        <link>${escapeXml(baseUrl)}</link>
        <pubDate>${buildDate}</pubDate>
      </item>`
    : rooms
        .map((room) => {
          const roomUrl = `${baseUrl}`;
          const description = `${room.memberCount} participant${room.memberCount !== 1 ? "s" : ""} online.`;
          const pubDate = new Date(room.createdAt).toUTCString();

          return `<item>
      <title>${escapeXml(room.roomName)}</title>
      <link>${escapeXml(roomUrl)}</link>
      <guid isPermaLink="false">${escapeXml(room.roomId)}</guid>
      <description>${description}</description>
      <pubDate>${pubDate}</pubDate>
    </item>`;
        })
        .join("\n    ");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Land of Smile — Active Rooms</title>
    <link>${escapeXml(baseUrl)}</link>
    <description>Live list of currently open voice rooms on Land of Smile. Updated on every request.</description>
    <language>th</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <ttl>2</ttl>
    <atom:link href="${escapeXml(baseUrl)}/api/rss" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
