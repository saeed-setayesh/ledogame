/* Verifies the WebRTC signaling relay end-to-end against a running dev server.
   Start the server first (npm run dev), then: npx tsx scripts/test-webrtc-relay.ts */
import { io as ioc, type Socket } from "socket.io-client";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const URL = "http://localhost:3000";
let pass = 0,
  fail = 0;
const check = (n: string, c: boolean) => {
  console.log(`  ${c ? "✓" : "✗"} ${n}`);
  c ? pass++ : fail++;
};
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function connect(): Promise<Socket> {
  return new Promise((res) => {
    const s = ioc(URL, { path: "/api/socket", transports: ["websocket"] });
    s.on("connect", () => res(s));
  });
}

async function main() {
  // Build a 2-human game so both sockets are legitimate members.
  const a = await prisma.user.findUniqueOrThrow({
    where: { email: "iamsaeedsetayesh@gmail.com" },
  });
  const b = await prisma.user.findUniqueOrThrow({
    where: { email: "p2@ledo.game" },
  });
  const game = await prisma.game.create({
    data: {
      roomId: "RTC" + Date.now(),
      gameType: "SOLO",
      gameMode: "CLASSIC",
      maxPlayers: 2,
      entryFee: 0,
      creatorId: a.id,
      status: "ACTIVE",
      startedAt: new Date(),
      players: {
        create: [
          { userId: a.id, position: 0, color: "RED", status: "ACTIVE" },
          { userId: b.id, position: 1, color: "BLUE", status: "ACTIVE" },
        ],
      },
    },
  });

  const sa = await connect();
  const sb = await connect();

  sa.emit("game:join", { gameId: game.id, userId: a.id });
  sb.emit("game:join", { gameId: game.id, userId: b.id });
  await wait(600);

  // A announces WebRTC readiness first.
  const aPeers: string[] = await new Promise((res) => {
    sa.once("webrtc:peers", (p) => res(p.peers));
    sa.emit("webrtc:join", { gameId: game.id, userId: a.id });
  });
  check("A's peer list initially excludes itself", !aPeers.includes(a.id));

  // B joins -> A should be notified.
  const joinedNotice: string = await new Promise((res) => {
    sa.once("webrtc:peer-joined", (p) => res(p.userId));
    sb.emit("webrtc:join", { gameId: game.id, userId: b.id });
  });
  check("A notified that B joined WebRTC", joinedNotice === b.id);

  // B's peer list should now contain A.
  const bPeers: string[] = await new Promise((res) => {
    sb.once("webrtc:peers", (p) => res(p.peers));
    sb.emit("webrtc:join", { gameId: game.id, userId: b.id });
  });
  check("B's peer list contains A", bPeers.includes(a.id));

  // Relay an SDP-ish blob A -> B.
  const relayed: any = await new Promise((res) => {
    sb.once("webrtc:signal", (m) => res(m));
    sa.emit("webrtc:signal", {
      toUserId: b.id,
      data: { description: { type: "offer", sdp: "FAKE" } },
    });
  });
  check("signal relayed A->B with correct fromUserId", relayed?.fromUserId === a.id);
  check("signal payload intact", relayed?.data?.description?.sdp === "FAKE");

  // Relay back B -> A.
  const back: any = await new Promise((res) => {
    sa.once("webrtc:signal", (m) => res(m));
    sb.emit("webrtc:signal", {
      toUserId: a.id,
      data: { candidate: { candidate: "cand" } },
    });
  });
  check("signal relayed B->A", back?.fromUserId === b.id && back?.data?.candidate?.candidate === "cand");

  // B disconnects -> A should get peer-left.
  const left: string = await new Promise((res) => {
    sa.once("webrtc:peer-left", (p) => res(p.userId));
    sb.disconnect();
  });
  check("A notified that B left", left === b.id);

  sa.disconnect();
  await prisma.gamePlayer.deleteMany({ where: { gameId: game.id } });
  await prisma.game.delete({ where: { id: game.id } });

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
