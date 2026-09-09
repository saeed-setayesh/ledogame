/* Withdrawal flow test (ledger-only mode). Server must be running.
   npx tsx scripts/test-withdrawal.ts */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const BASE = "http://localhost:3000";
let pass = 0,
  fail = 0;
const check = (n: string, c: boolean) => {
  console.log(`  ${c ? "✓" : "✗"} ${n}`);
  c ? pass++ : fail++;
};

async function login(email: string): Promise<string> {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();
  const c1 = (csrfRes.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .join("; ");
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: c1 },
    body: new URLSearchParams({
      csrfToken,
      email,
      password: "1378",
      callbackUrl: `${BASE}/`,
      json: "true",
    }).toString(),
    redirect: "manual",
  });
  const c2 = (res.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .join("; ");
  const map = new Map<string, string>();
  for (const p of [...c1.split("; "), ...c2.split("; ")]) {
    const [k, ...v] = p.split("=");
    if (k) map.set(k.trim(), v.join("="));
  }
  return [...map].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function main() {
  const A = await login("iamsaeedsetayesh@gmail.com");
  const uid = (
    await prisma.user.findUniqueOrThrow({
      where: { email: "iamsaeedsetayesh@gmail.com" },
    })
  ).id;
  await prisma.user.update({
    where: { id: uid },
    data: { walletBalance: 50 },
  });

  const DEST = "0x1111111111111111111111111111111111111111";

  console.log("Reject bad address");
  const bad = await fetch(`${BASE}/api/wallet/withdraw`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: A },
    body: JSON.stringify({ toAddress: "not-an-address", amount: 5 }),
  });
  check("400 on invalid address", bad.status === 400);

  console.log("Reject over-balance");
  const over = await fetch(`${BASE}/api/wallet/withdraw`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: A },
    body: JSON.stringify({ toAddress: DEST, amount: 999 }),
  });
  check("rejects amount > balance", over.status === 400);

  console.log("Valid withdrawal");
  const ok = await fetch(`${BASE}/api/wallet/withdraw`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: A },
    body: JSON.stringify({ toAddress: DEST, amount: 20 }),
  });
  const okJson = await ok.json();
  check("200 + txHash", ok.status === 200 && !!okJson.txHash);

  const after = await prisma.user.findUniqueOrThrow({ where: { id: uid } });
  check(
    `balance debited 50 -> ${after.walletBalance}`,
    Number(after.walletBalance) === 30
  );

  const tx = await prisma.transaction.findFirst({
    where: { userId: uid, type: "WITHDRAWAL" },
    orderBy: { createdAt: "desc" },
  });
  check("WITHDRAWAL transaction recorded", tx?.status === "COMPLETED");
  check("transaction amount = 20", Number(tx?.amount) === 20);

  console.log("Balance API reflects it");
  const balRes = await fetch(`${BASE}/api/wallet/balance`, { headers: { cookie: A } });
  const bal = await balRes.json();
  check("balance API = 30", Number(bal.balance ?? bal.walletBalance) === 30);

  await prisma.user.update({ where: { id: uid }, data: { walletBalance: 100 } });
  await prisma.$disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
