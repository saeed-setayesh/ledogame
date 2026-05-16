/** Binance Smart Chain (BEP20) — address helpers for USDT deposits/withdrawals. */

const HEX = /^0x[a-fA-F0-9]{40}$/;

export function validateBep20Address(addr: string): boolean {
  return HEX.test((addr || "").trim());
}
