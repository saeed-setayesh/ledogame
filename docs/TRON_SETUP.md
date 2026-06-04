# Tron USDT setup (development & production)

Real deposits use **TRC-20 USDT on TRON**. Each user gets a **custodial Tron deposit address**; USDT sent there is credited to their **platform balance** after confirmation.

## Where USDT goes when a user deposits 10 USDT

1. User opens **Wallet** → app creates a Tron address (starts with `T…`).
2. User sends **10 USDT (TRC-20)** from Binance / TronLink / etc. **to that `T…` address**.
3. The tokens sit **on-chain** in that deposit wallet (your server holds the encrypted private key).
4. User clicks **Scan for deposits** or **Confirm deposit** with the transaction id.
5. The app credits **`walletBalance` +10** in PostgreSQL (platform ledger for games).

Playing games uses the **ledger**, not moving USDT on-chain each bet. Withdrawals send USDT from the deposit wallet (or hot wallet) to the user’s external Tron address.

---

## What to put in `.env`

Copy these into **`.env`** locally and into **Railway / production** env vars (same names).

### Required for real Tron wallets

```env
# Development: testnet. Production: mainnet
TRON_NETWORK=shasta

# TronGrid API key (free at https://www.trongrid.io/)
TRON_API_KEY=your-trongrid-api-key

# Encrypts per-user deposit wallet private keys in the database
# Generate: openssl rand -hex 32
WALLET_ENCRYPTION_KEY=your-64-char-hex-key

# Hot wallet: funds new user wallets with TRX for gas + optional fallback withdrawals
# Must hold TRX (and optionally USDT) on the same network as TRON_NETWORK
TRON_PRIVATE_KEY=your-hot-wallet-private-key-hex
```

### Production example

```env
TRON_NETWORK=mainnet
TRON_API_KEY=...
WALLET_ENCRYPTION_KEY=...
TRON_PRIVATE_KEY=...
ALLOW_MOCK_DEPOSITS=false
ALLOW_LEDGER_ONLY_WITHDRAWALS=false
```

### Development example

```env
TRON_NETWORK=shasta
TRON_API_KEY=...
WALLET_ENCRYPTION_KEY=...
TRON_PRIVATE_KEY=...
ALLOW_MOCK_DEPOSITS=false
```

Use **Shasta testnet** USDT contract (configured automatically). Get test TRX/USDT from Shasta faucets before testing deposits.

### Optional

```env
COMMISSION_RATE=17
USE_REAL_TRON_WALLETS=true
ALLOW_MOCK_DEPOSITS=false
```

---

## Fix invalid values in your current `.env`

Your file has:

```env
TRON_NETWORK=mainnet|shasta
```

Change to **one** value only:

- Local testing: `TRON_NETWORK=shasta`
- Live site: `TRON_NETWORK=mainnet`

Remove empty placeholders — set real keys or deposits will fail.

---

## Database migration

After pulling these changes:

```bash
npx prisma migrate deploy
# or locally:
npx prisma db push
npx prisma generate
```

Adds `walletPrivateKeyEnc` and `walletNetwork` on `User`.

---

## User flow in the app

1. Open `/wallet` → real `T…` address is created.
2. Send USDT (TRC-20) on the correct network to that address.
3. **Scan for deposits** (automatic) or paste **transaction id** → **Confirm deposit**.
4. Balance updates; use for games; **Withdraw** to any Tron `T…` address.

---

## Security checklist

- Never commit `.env` or private keys.
- Set `WALLET_ENCRYPTION_KEY` in production (do not rely on dev fallback).
- Restrict who can access the database (encrypted keys inside).
- Fund `TRON_PRIVATE_KEY` wallet with TRX on each network you use.
- Disable `ALLOW_MOCK_DEPOSITS` on production.

See also: [WALLET_PAYMENTS.md](./WALLET_PAYMENTS.md)
