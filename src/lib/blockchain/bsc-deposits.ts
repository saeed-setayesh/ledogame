import {
  getBscScanApiBaseUrl,
  getBscUsdtContractAddress,
  BSC_USDT_DECIMALS,
} from "./bsc-network";
import { validateBep20Address } from "./bep20";

export interface Bep20IncomingTransfer {
  transactionId: string;
  from: string;
  to: string;
  amount: number;
  blockTimestamp?: number;
}

export async function fetchIncomingUsdtTransfers(
  ludinoAddress: string,
  fromAddress?: string,
  limit = 50
): Promise<Bep20IncomingTransfer[]> {
  if (!validateBep20Address(ludinoAddress)) return [];

  const base = getBscScanApiBaseUrl();
  const params = new URLSearchParams({
    module: "account",
    action: "tokentx",
    address: ludinoAddress,
    contractaddress: getBscUsdtContractAddress(),
    page: "1",
    offset: String(limit),
    sort: "desc",
  });
  const apiKey = process.env.BSCSCAN_API_KEY?.trim();
  if (apiKey) params.set("apikey", apiKey);

  const res = await fetch(`${base}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`BscScan API error (${res.status})`);
  }

  const json = (await res.json()) as {
    status: string;
    message: string;
    result: Array<{
      hash: string;
      from: string;
      to: string;
      value: string;
      timeStamp?: string;
    }> | string;
  };

  if (json.status !== "1" || !Array.isArray(json.result)) {
    if (json.message === "No transactions found") return [];
    throw new Error(json.message || "Failed to fetch transfers from BscScan");
  }

  const ludino = ludinoAddress.toLowerCase();
  const fromFilter = fromAddress?.toLowerCase();

  return json.result
    .filter((row) => row.to.toLowerCase() === ludino)
    .filter((row) => !fromFilter || row.from.toLowerCase() === fromFilter)
    .map((row) => ({
      transactionId: row.hash,
      from: row.from,
      to: row.to,
      amount: Number(row.value) / 10 ** BSC_USDT_DECIMALS,
      blockTimestamp: row.timeStamp ? Number(row.timeStamp) * 1000 : undefined,
    }));
}
