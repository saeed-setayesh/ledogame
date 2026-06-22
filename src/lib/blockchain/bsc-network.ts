/** BSC (BNB Smart Chain) network configuration. */

/** Official Binance-Peg BSC-USD (USDT BEP20) on BSC mainnet — 18 decimals. */
export const BSC_MAINNET_USDT =
  "0x55d398326f99059fF775485246999027B3197955";

export const BSC_TESTNET_USDT =
  "0x337610d27c682E00C0cAe907bD958375b6feeb0";

export function getBscNetwork(): "mainnet" | "testnet" {
  const raw = (process.env.BSC_NETWORK || "mainnet").trim().toLowerCase();
  const first = raw.split("|")[0]?.trim() || "mainnet";
  return first === "testnet" ? "testnet" : "mainnet";
}

export function getBscRpcUrls(): string[] {
  const custom = process.env.BSC_RPC_URL?.trim();
  if (custom) return [custom];

  if (getBscNetwork() === "mainnet") {
    return [
      "https://bsc-dataseed.binance.org",
      "https://bsc-dataseed1.binance.org",
      "https://bsc-dataseed2.binance.org",
      "https://rpc.ankr.com/bsc",
      "https://bsc.publicnode.com",
    ];
  }
  return ["https://bsc-testnet-rpc.publicnode.com"];
}

export function getBscRpcUrl(): string {
  return getBscRpcUrls()[0];
}

export function getBscNetworkLabel(): string {
  return getBscNetwork() === "mainnet"
    ? "BNB Smart Chain (BSC Mainnet)"
    : "BSC Testnet";
}

export function getBscScanBaseUrl(): string {
  return getBscNetwork() === "mainnet"
    ? "https://bscscan.com"
    : "https://testnet.bscscan.com";
}

/** BEP20 USDT on BSC (18 decimals). */
export function getBscUsdtContractAddress(): string {
  const custom = process.env.BSC_USDT_CONTRACT?.trim();
  if (custom) return custom;
  return getBscNetwork() === "mainnet"
    ? BSC_MAINNET_USDT
    : BSC_TESTNET_USDT;
}

export const BSC_USDT_DECIMALS = 18;
