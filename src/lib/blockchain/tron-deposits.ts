import { getUSDTContractAddress } from "./tron";
import {
  getTronGridBaseUrl,
  getTronNetwork,
  isTronBase58Address,
} from "./tron-network";

export interface Trc20IncomingTransfer {
  transactionId: string;
  from: string;
  to: string;
  amount: number;
  blockTimestamp?: number;
}

function trongridHeaders(): HeadersInit {
  const key = process.env.TRON_API_KEY?.trim();
  return key ? { "TRON-PRO-API-KEY": key } : {};
}

/** Recent USDT (TRC-20) transfers received by `depositAddress`. */
export async function fetchIncomingUsdtTransfers(
  depositAddress: string,
  limit = 40
): Promise<Trc20IncomingTransfer[]> {
  if (!isTronBase58Address(depositAddress)) {
    return [];
  }

  const base = getTronGridBaseUrl();
  const contract = getUSDTContractAddress();
  const url = `${base}/v1/accounts/${depositAddress}/transactions/trc20?only_to=true&limit=${limit}&contract_address=${contract}`;

  const res = await fetch(url, { headers: trongridHeaders() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TronGrid error (${res.status}): ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    data?: Array<{
      transaction_id: string;
      from: string;
      to: string;
      value: string;
      block_timestamp?: number;
      token_info?: { address?: string; symbol?: string };
    }>;
  };

  return (json.data || []).map((row) => ({
    transactionId: row.transaction_id,
    from: row.from,
    to: row.to,
    amount: Number(row.value) / 1_000_000,
    blockTimestamp: row.block_timestamp,
  }));
}

/** Verify a TRC-20 USDT deposit by transaction id (TronGrid). */
export async function verifyUsdtDepositTx(
  txHash: string,
  depositAddress: string
): Promise<{ amount: number; from: string }> {
  const normalizedHash = txHash.trim();
  const transfers = await fetchIncomingUsdtTransfers(depositAddress, 80);
  const hit = transfers.find((t) => t.transactionId === normalizedHash);

  if (!hit) {
    throw new Error(
      "Deposit not found yet. Wait for confirmation, then try “Scan for deposits” or check the transaction id."
    );
  }

  if (hit.to !== depositAddress) {
    throw new Error("Transfer was not sent to your deposit address");
  }

  if (hit.amount <= 0) {
    throw new Error("Invalid transfer amount");
  }

  return { amount: hit.amount, from: hit.from };
}

export function getDepositInstructions(): {
  network: string;
  usdtContract: string;
  isTestnet: boolean;
} {
  return {
    network: getTronNetwork(),
    usdtContract: getUSDTContractAddress(),
    isTestnet: getTronNetwork() !== "mainnet",
  };
}
