import { NextResponse } from "next/server";
import Ably from "ably";

export const dynamic = "force-dynamic";

interface RoomMember {
  displayName: string;
  isMuted: boolean;
  isScreenSharing: boolean;
}

interface RoomInfo {
  roomId: string;
  roomName: string;
  memberCount: number;
  members: RoomMember[];
  discoveredAt: Date;
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

        let roomName = "";
        const members: RoomMember[] = presenceResult.items.map(
          (m: { data?: unknown; clientId?: string }) => {
            let parsed: {
              displayName?: string;
              isMuted?: boolean;
              isScreenSharing?: boolean;
              roomName?: string;
            } = {};
            try {
              parsed =
                typeof m.data === "string"
                  ? JSON.parse(m.data)
                  : ((m.data as typeof parsed) ?? {});
            } catch {
              /* use empty defaults */
            }

            if (!roomName && parsed.roomName) roomName = parsed.roomName;

            return {
              displayName: parsed.displayName ?? m.clientId ?? "Unknown",
              isMuted: parsed.isMuted ?? false,
              isScreenSharing: parsed.isScreenSharing ?? false,
            };
          }
        );

        if (members.length > 0) {
          rooms.push({
            roomId,
            roomName: roomName || roomId,
            memberCount: members.length,
            members,
            discoveredAt: new Date(),
          });
        }
      } catch {
        // Channel exists but presence unavailable — skip
      }
    })
  );

  rooms.sort((a, b) => b.memberCount - a.memberCount);
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
          const roomUrl = `${baseUrl}/room/${encodeURIComponent(room.roomId)}`;
          const memberNames = room.members
            .map((m) => escapeXml(m.displayName))
            .join(", ");
          const screenSharers = room.members.filter((m) => m.isScreenSharing);

          const description = [
            `${room.memberCount} participant${room.memberCount !== 1 ? "s" : ""} online.`,
            memberNames ? `Members: ${memberNames}.` : "",
            screenSharers.length > 0
              ? `Screen sharing: ${screenSharers.map((m) => escapeXml(m.displayName)).join(", ")}.`
              : "",
          ]
            .filter(Boolean)
            .join(" ");

          return `<item>
      <title>${escapeXml(room.roomName)}</title>
      <link>${escapeXml(roomUrl)}</link>
      <guid isPermaLink="false">${escapeXml(room.roomId)}</guid>
      <description>${description}</description>
      <pubDate>${buildDate}</pubDate>
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
    <ttl>1</ttl>
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
