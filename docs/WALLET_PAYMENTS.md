# Wallet & payments (LUDINO) — BEP20 on BSC

Money uses **BEP20 USDT on BNB Smart Chain (BSC)** — not Tron.

## Flow

1. User sends USDT to **Ludino central wallet** (`LUDINO_USDT_ADDRESS`).
2. User confirms with **tx hash** or **Scan for deposits** → `walletBalance` credited.
3. Games use ledger (entry fee, payout, commission in DB).
4. Withdrawals: Ludino wallet sends BEP20 USDT to user's `0x` address.

## Env

See `.env.example` and [EMPLOYER_TESTING.md](./EMPLOYER_TESTING.md).

## APIs

| Endpoint | Purpose |
|----------|---------|
| `GET /api/wallet/balance` | Balance + Ludino deposit address |
| `GET /api/wallet/deposit-info` | Public readiness check (no auth) |
| `POST /api/wallet/deposit` | Confirm deposit by tx hash |
| `POST /api/wallet/deposit/sync` | Scan BscScan for new deposits |
| `POST /api/wallet/withdraw` | BEP20 withdrawal |

## Files

- `src/lib/blockchain/bsc.ts` — verify + transfer
- `src/lib/wallet/ludino-wallet.ts` — Ludino address from env
- `src/lib/blockchain/wallet.ts` — ledger operations
