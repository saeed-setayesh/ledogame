import { NextResponse } from "next/server";

/**
 * ICE server list for the in-game video/voice calls.
 *
 * STUN alone only works when both players can reach each other directly (same
 * Wi-Fi, or friendly NAT). For two phones on mobile data / different networks a
 * TURN relay is required. Configure your own with:
 *   TURN_URLS       comma-separated, e.g. "turn:turn.example.com:3478,turns:turn.example.com:5349"
 *   TURN_USERNAME
 *   TURN_CREDENTIAL
 * If unset, a public (rate-limited) relay is used as a best-effort fallback.
 */
export async function GET() {
  const iceServers: RTCIceServer[] = [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
      ],
    },
  ];

  const turnUrls = (process.env.TURN_URLS || process.env.TURN_URL || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const hasTurn =
    turnUrls.length > 0 &&
    !!process.env.TURN_USERNAME &&
    !!process.env.TURN_CREDENTIAL;

  if (hasTurn) {
    iceServers.push({
      urls: turnUrls,
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL,
    });
  }

  // `hasTurn: false` → video/voice only works when both players can reach each
  // other directly (same network / friendly NAT). Set TURN_URLS + creds for
  // reliable calls across mobile networks.
  return NextResponse.json(
    { iceServers, hasTurn },
    { headers: { "Cache-Control": "no-store" } }
  );
}
