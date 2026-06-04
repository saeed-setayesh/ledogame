/** Platform wallet / payment configuration (env-driven). */

export function getCommissionRatePercent(): number {
  const raw = parseFloat(process.env.COMMISSION_RATE || "17");
  if (Number.isNaN(raw)) return 17;
  return Math.min(100, Math.max(0, raw));
}

/** Commission as a fraction (e.g. 17 → 0.17). */
export function getCommissionRateFraction(): number {
  return getCommissionRatePercent() / 100;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Mock DB-only deposits; off unless explicitly enabled. */
export function allowMockDeposits(): boolean {
  return process.env.ALLOW_MOCK_DEPOSITS === "true";
}

export function useRealTronDeposits(): boolean {
  return process.env.USE_REAL_TRON_WALLETS !== "false";
}

/** Mock BEP20 addresses generated for dev — ledger-only, no on-chain ops. */
export function isLedgerOnlyWalletAddress(
  address: string | null | undefined
): boolean {
  return !address || address.startsWith("0x");
}

export function allowLedgerOnlyWithdrawals(): boolean {
  return (
    process.env.ALLOW_LEDGER_ONLY_WITHDRAWALS === "true" || !isProduction()
  );
}
