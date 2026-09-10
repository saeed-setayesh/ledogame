/* Reproduce the real Quick Match client flow: two users press "Find Opponent"
   at the same time, poll every 3s, navigate on "matched", then socket-join and
   wait for an ACTIVE board — exactly like Lobby.tsx + GamePage.tsx.
   Server must be running. Run: npx tsx scripts/test-matchmaking-live.ts */
import { PrismaClient } from "@prisma/client";
import { io as ioc, type Socket } from "socket.io-client";

const prisma = new PrismaClient();
const BASE = "http://localhost:3000";
let pass = 0,
  fail = 0;
const check = (n: string, c: boolean) => {
  console.log(`  ${c ? "✓" : "✗"} ${n}`);
  c ? pass++ : fail++;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function grab(res: Response): string {
  return (res.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .join("; ");
}
function merge(...cs: string[]): string {
  const m = new Map<string, string>();
  for (const c of cs.join("; ").split("; ")) {
    const i = c.indexOf("=");
    if (i > 0) m.set(c.slice(0, i), c.slice(i + 1));
  }
  return [...m].map(([k, v]) => `${k}=${v}`).join("; ");
}
async function login(email: string): Promise<{ cookie: string; id: string }> {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();
  const c1 = grab(csrfRes);
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: c1 },
    body: new URLSearchParams({
      csrfToken,
      email,
      password: "1378",
      callbackUrl: BASE,
      json: "true",
    }).toString(),
    redirect: "manual",
  });
  const cookie = merge(c1, grab(res));
  const s = await (
    await fetch(`${BASE}/api/auth/session`, { headers: { cookie } })
  ).json();
  if (!s?.user?.id) throw new Error(`login failed ${email}`);
  return { cookie, id: s.user.id };
}
async function mm(cookie: string, body: unknown) {
  const r = await fetch(`${BASE}/api/game/matchmake`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify(body),
  });
  return { ok: r.ok, json: await r.json() };
}

/** Emulate Lobby.tsx: poll every 3s, resolve gameId when status === matched. */
async function quickMatch(
  cookie: string,
  fee: number,
  mode: string,
  seats = 2,
  maxMs = 45000
): Promise<string | null> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const { ok, json } = await mm(cookie, {
      entryFee: fee,
      gameMode: mode,
      maxPlayers: seats,
    });
    if (!ok) return null;
    if (json.status === "matched" && json.gameId) return json.gameId;
    await sleep(2000);
  }
  return null;
}

/** Emulate GamePage.tsx: connect socket, join, wait for ACTIVE gameState. */
function joinAndWaitActive(
  gameId: string,
  userId: string,
  maxMs = 15000
): Promise<{ active: boolean; players: number }> {
  return new Promise((resolve) => {
    const sock: Socket = ioc(BASE, {
      path: "/api/socket",
      transports: ["websocket"],
    });
    let done = false;
    const finish = (active: boolean, players: number) => {
      if (done) return;
      done = true;
      sock.disconnect();
      resolve({ active, players });
    };
    sock.on("connect", () => {
      sock.emit("game:join", { gameId, userId });
      const retry = setInterval(
        () => sock.emit("game:join", { gameId, userId }),
        2500
      );
      sock.on("game:state", ({ gameState }: any) => {
        if (gameState?.gameStatus === "ACTIVE") {
          clearInterval(retry);
          finish(true, gameState.players.length);
        }
      });
      sock.on("game:started", () => sock.emit("game:join", { gameId, userId }));
    });
    setTimeout(() => finish(false, 0), maxMs);
  });
}

async function main() {
  const A = await login("iamsaeedsetayesh@gmail.com");
  const B = await login("p2@ledo.game");
  // Fund both, clear any lobbies.
  await prisma.user.updateMany({
    where: { id: { in: [A.id, B.id] } },
    data: { walletBalance: 100 },
  });
  await prisma.game.updateMany({
    where: {
      players: { some: { userId: { in: [A.id, B.id] } } },
      status: { in: ["WAITING", "ACTIVE"] },
    },
    data: { status: "CANCELLED", finishedAt: new Date() },
  });

  for (let round = 1; round <= 2; round++) {
    console.log(`\n--- Round ${round}: simultaneous Find Opponent (2p, 1 USDT) ---`);
    await mm(A.cookie, { cancel: true });
    await mm(B.cookie, { cancel: true });
    await sleep(200);

    // Both press the button at the same instant.
    const [gA, gB] = await Promise.all([
      quickMatch(A.cookie, 1, "CLASSIC", 2),
      quickMatch(B.cookie, 1, "CLASSIC", 2),
    ]);
    check(`A got a game (${gA})`, !!gA);
    check(`B got a game (${gB})`, !!gB);
    check("A and B are in the SAME game", !!gA && gA === gB);

    if (gA && gA === gB) {
      const [rA, rB] = await Promise.all([
        joinAndWaitActive(gA, A.id),
        joinAndWaitActive(gB, B.id),
      ]);
      check("A's board went ACTIVE", rA.active);
      check("B's board went ACTIVE", rB.active);
      check("both see 2 players", rA.players === 2 && rB.players === 2);
      await prisma.game.update({
        where: { id: gA },
        data: { status: "FINISHED", finishedAt: new Date() },
      });
    }
  }

  console.log("\n--- 3-player Quick Match: A + B + C ---");
  const C = await login("p3@ledo.game");
  await prisma.user.update({ where: { id: C.id }, data: { walletBalance: 100 } });
  await prisma.game.updateMany({
    where: { players: { some: { userId: C.id } }, status: { in: ["WAITING", "ACTIVE"] } },
    data: { status: "CANCELLED" },
  });
  for (const u of [A, B, C]) await mm(u.cookie, { cancel: true });
  await sleep(200);
  const [g3a, g3b, g3c] = await Promise.all([
    quickMatch(A.cookie, 1, "CLASSIC", 3),
    quickMatch(B.cookie, 1, "CLASSIC", 3),
    quickMatch(C.cookie, 1, "CLASSIC", 3),
  ]);
  check("all three got a game", !!g3a && !!g3b && !!g3c);
  check("all three in the SAME game", g3a === g3b && g3b === g3c);
  if (g3a && g3a === g3c) {
    const gs = await prisma.game.findUnique({
      where: { id: g3a },
      include: { players: true },
    });
    check("game ACTIVE with 3 players, pot 3", gs?.status === "ACTIVE" && gs?.players.length === 3 && Number(gs?.totalPot) === 3);
    await prisma.game.update({ where: { id: g3a }, data: { status: "FINISHED" } });
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
}
main();
