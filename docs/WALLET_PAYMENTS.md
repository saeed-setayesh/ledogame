# Wallet & payments (LUDINO)

This document describes how money moves on the platform after the wallet hardening implementation.

## Concepts

| Term | Meaning |
|------|---------|
| **Platform balance** | `User.walletBalance` — in-app USDT ledger used for games, deposits, withdrawals |
| **Deposit address** | `User.walletAddress` — real Tron `T…` address (TRC-20 USDT) |
| **Withdrawal address** | External Tron `T…` address entered by the user at withdraw time |

Gameplay uses **only** platform balance. Winning does not auto-send crypto; users withdraw manually.

## Transaction types

| Type | When |
|------|------|
| `DEPOSIT` | User tops up (mock or reported on-chain tx) |
| `WITHDRAWAL` | User sends balance to external BEP20 |
| `ENTRY_FEE` | Human player pays to join a **started** paid game |
| `PAYOUT` | Winner credited after game finish |
| `COMMISSION` | House share credited to `platform-ledger` user |
| `REFUND` | Entry fee returned (admin cancel after fees collected) |

## Flows

### 1. Deposit (charge account)

- **API:** `GET /api/wallet/balance`, `POST /api/wallet/deposit`, `POST /api/wallet/deposit/sync`
- User sends **TRC-20 USDT** to their Tron `T…` deposit address (custodial).
- **Scan for deposits** or confirm with **transaction id** → credits `walletBalance` (ledger).
- Mock deposits only if `ALLOW_MOCK_DEPOSITS=true`.
- Setup: [TRON_SETUP.md](./TRON_SETUP.md)

### 2. Join / create lobby

- **Create / join** only **check** balance ≥ `entryFee`; no deduction yet.
- **Practice:** `entryFee = 0`, game goes `ACTIVE` immediately (no fees).

### 3. Start paid game (entry fees)

Fees are collected in **one database transaction** for all **human** players (`userId` not starting with `AI_`):

- AI players never pay entry fees.
- Pot = `entryFee × human player count`.
- Triggered by:
  - `collectEntryFeesAndStartGame` when lobby is full **and** ≥ 2 humans (`tryAutoStartPaidGame` on join, or create when full).
  - Socket `game:start` (creator only, game `WAITING`).
- Idempotent: existing `ENTRY_FEE` per user/game is skipped.

**Files:** `src/lib/wallet/game-payments.ts`, `src/lib/blockchain/wallet.ts`

### 4. Play / lose

- No extra charge on loss; entry fee was paid at start.
- Winner settlement: `settleGameWinner` in `game-payments.ts` (socket `handleGameFinish`).

### 5. Win (payout)

- `payout = totalPot × (1 - COMMISSION_RATE/100)`
- Winner: `PAYOUT` transaction + balance credit (idempotent per game).
- House: `COMMISSION` to user `platform-ledger` (auto-created).

### 6. Withdraw (pay user)

- **API:** `POST /api/wallet/withdraw`
- **Ledger-only** (mock `0x` deposit address): debits balance immediately, `COMPLETED` withdrawal (dev).
- **On-chain:** requires `WALLET_KEY_<userId>` env; debits after successful `transferUSDT`.

## Cancel / refund

| Action | API | Behavior |
|--------|-----|----------|
| Creator cancel lobby | `POST /api/game/cancel` | `WAITING` only → `CANCELLED` (no fees yet) |
| Admin cancel | `POST /api/admin/games/cancel` | Refunds all `ENTRY_FEE` if charged, then `CANCELLED` |

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `COMMISSION_RATE` | `17` | Percent of pot kept by platform |
| `MIN_ENTRY_FEE` / `MAX_ENTRY_FEE` | `1` / `100` | Lobby create validation |
| `ALLOW_MOCK_DEPOSITS` | off in production | Allow test deposits |
| `ALLOW_LEDGER_ONLY_WITHDRAWALS` | on in dev | Withdraw without chain keys |
| `WALLET_KEY_<userId>` | — | Custodial key for on-chain withdraw |

## Implementation map

```
src/lib/wallet/config.ts          — env helpers
src/lib/wallet/platform-user.ts   — house ledger user
src/lib/wallet/game-payments.ts   — start, refund, settle
src/lib/blockchain/wallet.ts      — balance adjust, deposit, withdraw, fees
src/app/api/wallet/*              — HTTP wallet APIs
src/app/api/game/cancel           — creator cancel
src/app/api/admin/games/cancel    — admin cancel + refund
src/server/socket/game-handler.ts — game:start, finish
```

## What changed (summary)

1. Withdrawals debit `walletBalance` in DB (ledger-only path works in dev).
2. Deposits credit balance with duplicate `txHash` protection; mock deposits blocked in production.
3. Entry fees: atomic, humans only, pot = human fees only; AI excluded.
4. Paid games no longer flip to `ACTIVE` without collecting fees (fixed create/join).
5. Commission uses `COMMISSION_RATE` and records `COMMISSION` on platform user.
6. Payout/refund/fee operations are idempotent where possible.
7. Creator-only `game:start`; admin/creator cancel APIs with refunds.

## Still recommended for production

- On-chain deposit verification (confirm `txHash`, amount, recipient).
- Secure key storage (KMS) instead of `WALLET_KEY_*` env.
- Rate limits and min/max on withdraw.
- UI for cancel game and clearer “platform balance vs on-chain wallet” copy.
