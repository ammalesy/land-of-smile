import { NextResponse } from "next/server";
import Ably from "ably";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId") ?? "anonymous";

  const apiKey = process.env.ABLY_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Ably API key not configured" }, { status: 500 });
  }

  const client = new Ably.Rest(apiKey);
  const tokenRequest = await client.auth.createTokenRequest({ clientId });

  return NextResponse.json(tokenRequest);
}
