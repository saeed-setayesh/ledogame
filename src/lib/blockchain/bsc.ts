import {
  Contract,
  JsonRpcProvider,
  Wallet,
  formatUnits,
  parseUnits,
  Interface,
} from "ethers";
import {
  getBscNetwork,
  getBscRpcUrl,
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

export function getProvider(): JsonRpcProvider {
  return new JsonRpcProvider(getBscRpcUrl());
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
  const value = parseUnits(amount.toFixed(BSC_USDT_DECIMALS), BSC_USDT_DECIMALS);
  const tx = await contract.transfer(toAddress, value);
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error("Transfer transaction failed");
  }
  return receipt.hash;
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

  const provider = getProvider();
  const receipt = await provider.getTransactionReceipt(hash);
  if (!receipt) {
    throw new Error(
      "Transaction not found yet. Wait for confirmation and try again."
    );
  }
  if (receipt.status !== 1) {
    throw new Error("Transaction failed on-chain");
  }

  const usdt = getBscUsdtContractAddress().toLowerCase();
  const ludino = ludinoAddress.toLowerCase();

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== usdt) continue;
    try {
      const parsed = TRANSFER_IFACE.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });
      if (!parsed || parsed.name !== "Transfer") continue;
      const to = String(parsed.args.to).toLowerCase();
      if (to !== ludino) continue;
      const amount = parseFloat(
        formatUnits(parsed.args.value as bigint, BSC_USDT_DECIMALS)
      );
      if (amount <= 0) continue;
      return { amount, from: String(parsed.args.from) };
    } catch {
      continue;
    }
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
