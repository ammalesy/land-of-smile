import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const username = process.env.TURN_USERNAME ?? "openrelayproject";
  const credential = process.env.TURN_CREDENTIAL ?? "openrelayproject";

  const iceServers: RTCIceServer[] = [
    // STUN servers
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    // TURN servers — relay traffic when P2P fails (e.g. Mobile ↔ PC across NAT)
    {
      urls: "turn:openrelay.metered.ca:80",
      username,
      credential,
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username,
      credential,
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username,
      credential,
    },
    {
      urls: "turns:openrelay.metered.ca:443",
      username,
      credential,
    },
  ];

  return NextResponse.json({ iceServers }, {
    headers: { "Cache-Control": "no-store" },
  });
}
