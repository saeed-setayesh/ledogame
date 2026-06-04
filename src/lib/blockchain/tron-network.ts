/** Parse TRON_NETWORK env (handles typos like `mainnet|shasta`). */
export function getTronNetwork(): "mainnet" | "shasta" {
  const raw = (process.env.TRON_NETWORK || "shasta").trim().toLowerCase();
  const first = raw.split("|")[0]?.trim() || "shasta";
  return first === "mainnet" ? "mainnet" : "shasta";
}

export function getTronGridBaseUrl(): string {
  return getTronNetwork() === "mainnet"
    ? "https://api.trongrid.io"
    : "https://api.shasta.trongrid.io";
}

export function getTronNetworkLabel(): string {
  return getTronNetwork() === "mainnet" ? "TRON Mainnet" : "TRON Shasta (testnet)";
}

export function isTronBase58Address(address: string): boolean {
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test((address || "").trim());
}
