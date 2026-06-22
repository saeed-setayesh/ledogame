import {
  Contract,
  JsonRpcProvider,
  Wallet,
  formatUnits,
  parseUnits,
  Interface,
  getAddress,
} from "ethers";
import {
  BSC_MAINNET_USDT,
  getBscNetwork,
  getBscRpcUrls,
  getBscUsdtContractAddress,
  BSC_USDT_DECIMALS,
} from "./bsc-network";
import { validateBep20Address } from "./bep20";

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

const TRANSFER_IFACE = new Interface(ERC20_ABI);
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const KNOWN_BSC_USDT = new Set(
  [BSC_MAINNET_USDT, process.env.BSC_USDT_CONTRACT?.trim()].filter(Boolean).map(
    (a) => a!.toLowerCase()
  )
);

function normalizeAddress(addr: string): string {
  return getAddress(addr.trim());
}

async function getReceiptWithFallback(txHash: string) {
  for (const url of getBscRpcUrls()) {
    try {
      const provider = new JsonRpcProvider(url);
      const receipt = await provider.getTransactionReceipt(txHash);
      if (receipt) return receipt;
    } catch (err) {
      console.warn(`[bsc] RPC ${url} failed for receipt:`, err);
    }
  }
  return null;
}

export function getProvider(): JsonRpcProvider {
  return new JsonRpcProvider(getBscRpcUrls()[0]);
}

export async function getUsdtBalance(address: string): Promise<number> {
  if (!validateBep20Address(address)) return 0;
  const provider = getProvider();
  const contract = new Contract(
    getBscUsdtContractAddress(),
    ERC20_ABI,
    provider
  );
  const raw: bigint = await contract.balanceOf(address);
  return parseFloat(formatUnits(raw, BSC_USDT_DECIMALS));
}

export async function transferUsdt(
  privateKey: string,
  toAddress: string,
  amount: number
): Promise<string> {
  if (!validateBep20Address(toAddress)) {
    throw new Error("Invalid BEP20 address");
  }
  const key = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  const provider = getProvider();
  const wallet = new Wallet(key, provider);
  const contract = new Contract(
    getBscUsdtContractAddress(),
    ERC20_ABI,
    wallet
  );
  const value = parseUnits(
    amount.toFixed(BSC_USDT_DECIMALS),
    BSC_USDT_DECIMALS
  );
  const tx = await contract.transfer(toAddress, value);
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error("Transfer transaction failed");
  }
  return receipt.hash;
}

function parseTransferLog(
  log: { address: string; topics: readonly string[]; data: string },
  ludinoAddress: string
): { amount: number; from: string } | null {
  if (!log.topics[0] || log.topics[0].toLowerCase() !== TRANSFER_TOPIC) {
    return null;
  }

  const ludino = ludinoAddress.toLowerCase();

  try {
    const parsed = TRANSFER_IFACE.parseLog({
      topics: log.topics as string[],
      data: log.data,
    });
    if (!parsed || parsed.name !== "Transfer") return null;
    const to = String(parsed.args.to).toLowerCase();
    if (to !== ludino) return null;

    const contract = log.address.toLowerCase();
    if (!KNOWN_BSC_USDT.has(contract)) {
      console.warn(
        `[bsc] Transfer to Ludino from non-standard token ${log.address}`
      );
    }

    const amount = parseFloat(
      formatUnits(parsed.args.value as bigint, BSC_USDT_DECIMALS)
    );
    if (amount <= 0) return null;
    return { amount, from: String(parsed.args.from) };
  } catch {
    if (log.topics.length < 3) return null;
    const ludinoLower = ludinoAddress.toLowerCase();
    const to = ("0x" + log.topics[2].slice(-40)).toLowerCase();
    if (to !== ludinoLower) return null;
    const from = "0x" + log.topics[1].slice(-40);
    const amount = parseFloat(formatUnits(log.data, BSC_USDT_DECIMALS));
    if (amount <= 0) return null;
    return { amount, from };
  }
}

export async function verifyBep20UsdtDeposit(
  txHash: string,
  ludinoAddress: string
): Promise<{ amount: number; from: string }> {
  const hash = txHash.trim();
  if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) {
    throw new Error("Invalid transaction hash");
  }
  if (!validateBep20Address(ludinoAddress)) {
    throw new Error("Ludino wallet address is not configured");
  }

  const ludino = normalizeAddress(ludinoAddress);
  const receipt = await getReceiptWithFallback(hash);

  if (!receipt) {
    throw new Error(
      "Transaction not found yet. Wait for confirmation and try again."
    );
  }
  if (receipt.status !== 1) {
    throw new Error("Transaction failed on-chain");
  }

  for (const log of receipt.logs) {
    const hit = parseTransferLog(log, ludino);
    if (hit) return hit;
  }

  throw new Error(
    "No USDT (BEP20) transfer to the Ludino wallet found in this transaction"
  );
}

export function getDepositInstructions() {
  return {
    network: getBscNetwork(),
    usdtContract: getBscUsdtContractAddress(),
    isTestnet: getBscNetwork() !== "mainnet",
  };
}
