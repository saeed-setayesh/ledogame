/* End-to-end matchmaking + invite test against a running dev server.
   Start server first, then: npx tsx scripts/test-matchmaking.ts */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const BASE = "http://localhost:3000";

async function gameStatus(id: string) {
  const g = await prisma.game.findUnique({
    where: { id },
    include: { players: true },
  });
  return g
    ? { status: g.status, players: g.players.length, pot: Number(g.totalPot) }
    : null;
}
let pass = 0,
  fail = 0;
const check = (n: string, c: boolean) => {
  console.log(`  ${c ? "✓" : "✗"} ${n}`);
  c ? pass++ : fail++;
};

async function login(email: string): Promise<string> {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();
  const cookies = grabCookies(csrfRes);

  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      cookie: cookies,
    },
    body: new URLSearchParams({
      csrfToken,
      email,
      password: "1378",
      callbackUrl: `${BASE}/`,
      json: "true",
    }).toString(),
    redirect: "manual",
  });
  const session = grabCookies(res);
  const all = mergeCookies(cookies, session);
  // sanity: session should work
  const s = await fetch(`${BASE}/api/auth/session`, { headers: { cookie: all } });
  const sj = await s.json();
  if (!sj?.user?.id) throw new Error(`login failed for ${email}: ${JSON.stringify(sj)}`);
  return all;
}

function grabCookies(res: Response): string {
  const raw = res.headers.getSetCookie?.() ?? [];
  return raw.map((c) => c.split(";")[0]).join("; ");
}
function mergeCookies(a: string, b: string): string {
  const map = new Map<string, string>();
  for (const part of [...a.split("; "), ...b.split("; ")]) {
    const [k, ...v] = part.split("=");
    if (k) map.set(k.trim(), v.join("="));
  }
  return [...map].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function api(cookie: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify(body ?? {}),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

async function main() {
  const A = await login("iamsaeedsetayesh@gmail.com");
  const B = await login("p2@ledo.game");

  // Fresh slate: retire every non-finished game these two are in, top up balances.
  const ids = (
    await prisma.user.findMany({
      where: { email: { in: ["iamsaeedsetayesh@gmail.com", "p2@ledo.game"] } },
      select: { id: true },
    })
  ).map((u) => u.id);
  await prisma.game.updateMany({
    where: {
      players: { some: { userId: { in: ids } } },
      status: { in: ["WAITING", "ACTIVE"] },
    },
    data: { status: "FINISHED", finishedAt: new Date() },
  });
  await prisma.user.updateMany({
    where: { id: { in: ids } },
    data: { walletBalance: 100 },
  });
  await api(A, "/api/game/matchmake", { cancel: true });
  await api(B, "/api/game/matchmake", { cancel: true });
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const finishAll = () =>
    prisma.game.updateMany({
      where: {
        players: { some: { userId: { in: ids } } },
        status: { in: ["WAITING", "ACTIVE"] },
      },
      data: { status: "FINISHED", finishedAt: new Date() },
    });

  console.log("Matchmaking: two users, same bucket, get paired by the server");
  const a1 = await api(A, "/api/game/matchmake", { entryFee: 1, gameMode: "CLASSIC" });
  const b1 = await api(B, "/api/game/matchmake", { entryFee: 1, gameMode: "CLASSIC" });
  check("A searching", a1.json.status === "searching");
  check("B searching", b1.json.status === "searching");

  // Server-side pairer runs every ~1.5s.
  await sleep(4000);
  const a2 = await api(A, "/api/game/matchmake", { entryFee: 1, gameMode: "CLASSIC" });
  const b2 = await api(B, "/api/game/matchmake", { entryFee: 1, gameMode: "CLASSIC" });
  check("A matched", a2.json.status === "matched" && !!a2.json.gameId);
  check("B matched", b2.json.status === "matched" && !!b2.json.gameId);
  check("A + B in the SAME game", a2.json.gameId === b2.json.gameId);

  const gs = await gameStatus(a2.json.gameId);
  check("game is ACTIVE", gs?.status === "ACTIVE");
  check("2 players, pot = 2× fee", gs?.players === 2 && gs?.pot === 2);

  console.log("\nA stuck practice game (has a bot) is NEVER resumed by Quick Match");
  await finishAll();
  await api(A, "/api/game/matchmake", { cancel: true });
  // fake a lingering ACTIVE practice game: A + an AI, SOLO/2p, non-QM roomId
  const practice = await prisma.game.create({
    data: {
      roomId: "practice" + Date.now(),
      gameType: "SOLO",
      gameMode: "CLASSIC",
      maxPlayers: 2,
      entryFee: 0,
      creatorId: ids[0],
      status: "ACTIVE",
      startedAt: new Date(),
      players: {
        create: [
          { userId: ids[0], position: 0, color: "RED", status: "ACTIVE" },
          { userId: "AI_0", position: 1, color: "BLUE", status: "ACTIVE" },
        ],
      },
    },
  });
  const aStuck = await api(A, "/api/game/matchmake", { entryFee: 1, gameMode: "CLASSIC" });
  check("Quick Match ignores the bot game (status searching)", aStuck.json.status === "searching");
  check("…and points at a NEW game, not the practice one", aStuck.json.gameId !== practice.id);
  await prisma.game.update({ where: { id: practice.id }, data: { status: "FINISHED" } });

  console.log("\nDifferent buckets don't cross-match");
  await finishAll();
  await api(A, "/api/game/matchmake", { cancel: true });
  await api(B, "/api/game/matchmake", { cancel: true });
  const a3 = await api(A, "/api/game/matchmake", { entryFee: 2, gameMode: "CLASSIC" });
  const b3 = await api(B, "/api/game/matchmake", { entryFee: 5, gameMode: "CLASSIC" });
  check("A searching (fee 2)", a3.json.status === "searching");
  check("B searching (fee 5)", b3.json.status === "searching");
  await sleep(4000);
  const a3b = await api(A, "/api/game/matchmake", { entryFee: 2, gameMode: "CLASSIC" });
  check("A still searching — no cross-bucket match", a3b.json.status === "searching");
  await api(A, "/api/game/matchmake", { cancel: true });
  await api(B, "/api/game/matchmake", { cancel: true });
  await finishAll();

  console.log("\nFriend invite flow");
  // ensure friendship
  await api(A, "/api/friends/add", { username: "player2" });
  await api(B, "/api/friends/accept", { friendId: (await (await fetch(`${BASE}/api/auth/session`,{headers:{cookie:A}})).json()).user.id });

  const inv = await api(A, "/api/game/invite", {
    toUserId: (await (await fetch(`${BASE}/api/auth/session`, { headers: { cookie: B } })).json()).user.id,
    entryFee: 0,
    gameMode: "RUSH",
  });
  check("invite created", !!inv.json.inviteId && !!inv.json.gameId);

  const list = await fetch(`${BASE}/api/game/invite`, { headers: { cookie: B } });
  const lj = await list.json();
  check("B sees the pending invite", lj.invites?.some((i: any) => i.id === inv.json.inviteId));
  check("invite carries RUSH mode", lj.invites?.[0]?.gameMode === "RUSH");

  const resp = await api(B, "/api/game/invite/respond", {
    inviteId: inv.json.inviteId,
    accept: true,
  });
  check("B accepted → game id returned", resp.json.gameId === inv.json.gameId);
  check("accepted status", resp.json.status === "accepted");

  const g2 = await gameStatus(inv.json.gameId);
  check("invited game is ACTIVE with 2 players", g2?.status === "ACTIVE" && g2?.players === 2);

  await prisma.$disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
