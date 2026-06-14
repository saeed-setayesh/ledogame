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

export function allowLedgerOnlyWithdrawals(): boolean {
  return process.env.ALLOW_LEDGER_ONLY_WITHDRAWALS === "true";
}
