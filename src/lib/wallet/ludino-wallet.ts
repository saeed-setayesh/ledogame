import { validateBep20Address } from "@/lib/blockchain/bep20";
import { getBscNetwork } from "@/lib/blockchain/bsc-network";

/**
 * Ludino central BEP20 USDT wallet — all user deposits and commission land here.
 * Set LUDINO_USDT_ADDRESS (or GAME_WALLET_ADDRESS) in .env / Railway.
 */
export function getLudinoUsdtAddress(): string {
  const addr =
    process.env.LUDINO_USDT_ADDRESS?.trim() ||
    process.env.GAME_WALLET_ADDRESS?.trim();

  if (!addr || !validateBep20Address(addr)) {
    throw new Error(
      "LUDINO_USDT_ADDRESS is not set. Add your Ludino BEP20 USDT wallet (0x…) to .env"
    );
  }
  return addr;
}

export function getLudinoWalletPrivateKey(): string | null {
  const key =
    process.env.BSC_PRIVATE_KEY?.trim() ||
    process.env.GAME_WALLET_PRIVATE_KEY?.trim();
  return key || null;
}

export function requireLudinoWalletPrivateKey(): string {
  const key = getLudinoWalletPrivateKey();
  if (!key) {
    throw new Error(
      "BSC_PRIVATE_KEY is not set. Required for withdrawals on BSC."
    );
  }
  return key;
}

export function getLudinoWalletInfo() {
  return {
    address: getLudinoUsdtAddress(),
    network: getBscNetwork(),
    hasPrivateKey: !!getLudinoWalletPrivateKey(),
  };
}
