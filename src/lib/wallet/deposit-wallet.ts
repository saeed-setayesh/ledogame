import { prisma } from "@/lib/prisma";
import { createWallet, getTronWeb, transferUSDT } from "@/lib/blockchain/tron";
import { getTronNetwork } from "@/lib/blockchain/tron-network";
import { isLedgerOnlyWalletAddress } from "@/lib/wallet/config";
import { encryptSecret, decryptSecret } from "@/lib/wallet/encryption";

const TRX_FUND_SUN = 2_000_000; // 2 TRX for first withdrawals (gas)

export async function getUserDepositPrivateKey(
  userId: string
): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { walletPrivateKeyEnc: true, walletAddress: true },
  });
  if (!user?.walletPrivateKeyEnc || isLedgerOnlyWalletAddress(user.walletAddress)) {
    return null;
  }
  return decryptSecret(user.walletPrivateKeyEnc);
}

/**
 * Assign a real Tron deposit wallet (custodial). Migrates legacy mock `0x` addresses.
 */
export async function ensureUserDepositWallet(userId: string): Promise<{
  address: string;
  network: string;
  migratedFromMock: boolean;
  isNew: boolean;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      walletAddress: true,
      walletPrivateKeyEnc: true,
      walletNetwork: true,
    },
  });

  const hasRealWallet =
    user?.walletAddress &&
    !isLedgerOnlyWalletAddress(user.walletAddress) &&
    user.walletPrivateKeyEnc;

  if (hasRealWallet) {
    return {
      address: user!.walletAddress!,
      network: user!.walletNetwork || getTronNetwork(),
      migratedFromMock: false,
      isNew: false,
    };
  }

  const migratedFromMock = isLedgerOnlyWalletAddress(user?.walletAddress);
  const { address, privateKey } = await createWallet();
  const network = getTronNetwork();

  await prisma.user.update({
    where: { id: userId },
    data: {
      walletAddress: address,
      walletPrivateKeyEnc: encryptSecret(privateKey),
      walletNetwork: network,
    },
  });

  await fundDepositWalletGas(address).catch((err) => {
    console.warn(`[wallet] TRX fund skipped for ${address}:`, err.message);
  });

  return {
    address,
    network,
    migratedFromMock,
    isNew: true,
  };
}

/** Send a small TRX amount from the platform hot wallet so USDT withdrawals can pay gas. */
async function fundDepositWalletGas(depositAddress: string): Promise<void> {
  const hotKey = process.env.TRON_PRIVATE_KEY?.trim();
  if (!hotKey) return;

  const tronWeb = getTronWeb();
  tronWeb.setPrivateKey(hotKey);
  const from = tronWeb.defaultAddress.base58 as string;
  if (!from) return;

  const unsigned = await tronWeb.transactionBuilder.sendTrx(
    depositAddress,
    TRX_FUND_SUN,
    from
  );
  const signed = await tronWeb.trx.sign(unsigned);
  await tronWeb.trx.sendRawTransaction(signed);
}

export async function resolveWithdrawalPrivateKey(
  userId: string
): Promise<string> {
  const userKey = await getUserDepositPrivateKey(userId);
  if (userKey) return userKey;

  const hotKey = process.env.TRON_PRIVATE_KEY?.trim();
  if (hotKey) return hotKey;

  throw new Error(
    "Withdrawal wallet is not configured. Set TRON_PRIVATE_KEY (hot wallet) on the server."
  );
}
