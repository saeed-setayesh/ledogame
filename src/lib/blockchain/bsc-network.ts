/** BSC (BNB Smart Chain) network configuration. */

export function getBscNetwork(): "mainnet" | "testnet" {
  const raw = (process.env.BSC_NETWORK || "mainnet").trim().toLowerCase();
  const first = raw.split("|")[0]?.trim() || "mainnet";
  return first === "testnet" ? "testnet" : "mainnet";
}

export function getBscRpcUrl(): string {
  const custom = process.env.BSC_RPC_URL?.trim();
  if (custom) return custom;
  return getBscNetwork() === "mainnet"
    ? "https://bsc-dataseed.binance.org"
    : "https://bsc-testnet-rpc.publicnode.com";
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

export function getBscScanApiBaseUrl(): string {
  return getBscNetwork() === "mainnet"
    ? "https://api.bscscan.com/api"
    : "https://api-testnet.bscscan.com/api";
}

/** BEP20 USDT on BSC (18 decimals). */
export function getBscUsdtContractAddress(): string {
  const custom = process.env.BSC_USDT_CONTRACT?.trim();
  if (custom) return custom;
  return getBscNetwork() === "mainnet"
    ? "0x55d398326f99059fF7728373c0D4c4d0E0C294"
    : "0x337610d27c682E00C0cAe907bD958375b6feeb0";
}

export const BSC_USDT_DECIMALS = 18;
