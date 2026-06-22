import { Contract, JsonRpcProvider } from "ethers";
import {
  getBscRpcUrls,
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

const ERC20_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

/** Fetch recent USDT transfers to Ludino via BSC RPC (no BscScan API). */
export async function fetchIncomingUsdtTransfers(
  ludinoAddress: string,
  fromAddress?: string,
  limit = 50
): Promise<Bep20IncomingTransfer[]> {
  if (!validateBep20Address(ludinoAddress)) return [];

  const ludino = ludinoAddress.toLowerCase();
  const fromFilter = fromAddress?.toLowerCase();
  const usdt = getBscUsdtContractAddress();

  for (const rpcUrl of getBscRpcUrls()) {
    try {
      const provider = new JsonRpcProvider(rpcUrl);
      const contract = new Contract(usdt, ERC20_ABI, provider);
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 200_000);

      const filter = contract.filters.Transfer(null, ludinoAddress);
      const logs = await contract.queryFilter(filter, fromBlock, currentBlock);

      const transfers: Bep20IncomingTransfer[] = [];

      for (const log of logs.reverse()) {
        if (!log.args) continue;
        const from = String(log.args.from);
        const to = String(log.args.to);
        if (to.toLowerCase() !== ludino) continue;
        if (fromFilter && from.toLowerCase() !== fromFilter) continue;

        const amount =
          Number(log.args.value) / 10 ** BSC_USDT_DECIMALS;
        if (amount <= 0) continue;

        transfers.push({
          transactionId: log.transactionHash,
          from,
          to,
          amount,
        });
        if (transfers.length >= limit) break;
      }

      return transfers;
    } catch (err) {
      console.warn(`[bsc-deposits] RPC ${rpcUrl} failed:`, err);
    }
  }

  throw new Error(
    "Could not load deposits from BSC. Try confirming with your transaction hash instead."
  );
}
