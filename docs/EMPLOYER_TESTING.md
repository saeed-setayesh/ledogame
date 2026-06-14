# Ludino BEP20 — employer testing guide

Send this to your employer once `.env` is configured on **ludino.net** (or staging).

---

## English (for employer)

**LUDINO wallet is ready for BEP20 USDT testing on BNB Smart Chain (BSC).**

### Ludino deposit address (send USDT here)

```
{{LUDINO_USDT_ADDRESS}}
```

- **Network:** BSC Mainnet (BNB Smart Chain)  
- **Token:** USDT **BEP20** (not Tron TRC-20)  
- **USDT contract:** `0x55d398326f99059fF7728373c0D4c4d0E0C294`  
- **BscScan:** https://bscscan.com/address/{{LUDINO_USDT_ADDRESS}}

### How to test

1. **Fund Ludino wallet (optional):** Send USDT + a little BNB (gas) to the address above from your exchange or MetaMask.
2. **Create a Ludino test account** (or use yours) at https://ludino.net
3. **Deposit for play balance:**
   - Send USDT (BEP20) **from your wallet** **to the Ludino address above**
   - Open **Wallet** in the app
   - Paste the **transaction hash** from BscScan → **Confirm deposit**
   - Or: enter your **sending 0x address** → **Scan for deposits**
4. **Play:** Create/join a game with entry fee; balance is deducted when the game starts.
5. **Withdraw:** Enter your BEP20 `0x…` address and amount.

### Suggested test amounts

| Step | Amount |
|------|--------|
| First Ludino wallet funding | 20–50 USDT + ~0.01 BNB gas |
| Per test deposit | 3–10 USDT |
| Entry fee in game | 1–3 USDT |

---

## فارسی (برای کارفرما)

**ولت لدینو برای تست با USDT روی شبکه BEP20 (BSC) آماده است.**

### آدرس ولت لدینو (USDT به این آدرس بفرستید)

```
{{LUDINO_USDT_ADDRESS}}
```

- **شبکه:** BSC Mainnet (BNB Smart Chain)  
- **ارز:** USDT نوع **BEP20** (نه Tron)  
- **قرارداد USDT:** `0x55d398326f99059fF7728373c0D4c4d0E0C294`

### مراحل تست

1. به آدرس بالا **USDT BEP20** (+ مقدار کم **BNB** برای گس) بفرستید.
2. در **ludino.net** با اکانت تست وارد شوید.
3. از **Wallet** → هش تراکنش را بعد از واریز paste کنید → **Confirm deposit**.
4. بازی با entry fee را تست کنید.
5. برداشت به آدرس `0x…` خودتان.

**می‌توانید USDT بزنید برای تست نهایی.**

---

## Dev setup (you, before telling employer)

1. Copy employer’s Ludino **0x** address into `.env` and Railway:

```env
BSC_NETWORK=mainnet
LUDINO_USDT_ADDRESS=0x...
BSC_PRIVATE_KEY=...   # same wallet, for withdrawals
BSCSCAN_API_KEY=...   # optional
ALLOW_MOCK_DEPOSITS=false
```

2. Redeploy ludino.net.

3. Verify: open  
   `https://ludino.net/api/wallet/deposit-info`  
   → should show `ready: true` and the deposit address.

4. Replace `{{LUDINO_USDT_ADDRESS}}` in this doc with the real address and send to employer.

---

## Technical summary

| Item | Detail |
|------|--------|
| Chain | BSC BEP20 USDT |
| Deposit model | Central Ludino wallet + platform ledger |
| Commission | Stays in Ludino wallet on-chain; 17% recorded in DB |
| Tron | Disabled for deposits (employer request) |
