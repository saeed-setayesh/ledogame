import { prisma } from "@/lib/prisma"
import { getUSDTBalance, transferUSDT } from "./tron"
import { validateAddress as validateTronAddress } from "./tron"
import { verifyUsdtDepositTx } from "./tron-deposits"
import { Decimal } from "@prisma/client/runtime/library"
import type { Prisma } from "@prisma/client"
import {
  allowLedgerOnlyWithdrawals,
  allowMockDeposits,
  getCommissionRateFraction,
  getCommissionRatePercent,
  isLedgerOnlyWalletAddress,
} from "@/lib/wallet/config"
import { getPlatformLedgerUserId } from "@/lib/wallet/platform-user"
import {
  ensureUserDepositWallet,
  resolveWithdrawalPrivateKey,
} from "@/lib/wallet/deposit-wallet"
import { isTronBase58Address } from "@/lib/blockchain/tron-network"

export { getCommissionRateFraction, getCommissionRatePercent }

type DbTx = Prisma.TransactionClient

/** Platform play balance (ledger). Never overwrite from on-chain USDT. */
export async function getUserLedgerBalance(userId: string): Promise<number> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { walletBalance: true },
  })
  return row ? parseFloat(row.walletBalance.toString()) : 0
}

/** @deprecated Use ensureUserDepositWallet — creates Tron wallet + encrypted key */
export async function createUserWallet(userId: string): Promise<string> {
  const { address } = await ensureUserDepositWallet(userId)
  return address
}

/** On-chain USDT at deposit address (informational). Does not change ledger. */
export async function getOnChainUsdtBalance(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { walletAddress: true },
  })
  if (!user?.walletAddress || isLedgerOnlyWalletAddress(user.walletAddress)) {
    return 0
  }
  return getUSDTBalance(user.walletAddress)
}

async function adjustBalanceInTx(
  tx: DbTx,
  userId: string,
  delta: number
): Promise<number> {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { walletBalance: true },
  })
  if (!user) throw new Error("User not found")
  const next = parseFloat(user.walletBalance.toString()) + delta
  if (next < -0.000001) throw new Error("Insufficient balance")
  await tx.user.update({
    where: { id: userId },
    data: { walletBalance: new Decimal(Math.max(0, next)) },
  })
  return next
}

export async function entryFeeAlreadyCharged(
  tx: DbTx,
  userId: string,
  gameId: string
): Promise<boolean> {
  const existing = await tx.transaction.findFirst({
    where: {
      userId,
      gameId,
      type: "ENTRY_FEE",
      status: "COMPLETED",
    },
  })
  return !!existing
}

export async function entryFeeRefundExists(
  tx: DbTx,
  userId: string,
  gameId: string,
  amount: number
): Promise<boolean> {
  const existing = await tx.transaction.findFirst({
    where: {
      userId,
      gameId,
      type: "REFUND",
      status: "COMPLETED",
      amount: new Decimal(amount),
    },
  })
  return !!existing
}

export async function deductEntryFeeInTx(
  tx: DbTx,
  userId: string,
  amount: number,
  gameId: string
): Promise<void> {
  if (await entryFeeAlreadyCharged(tx, userId, gameId)) return
  await adjustBalanceInTx(tx, userId, -amount)
  await tx.transaction.create({
    data: {
      userId,
      type: "ENTRY_FEE",
      amount: new Decimal(amount),
      status: "COMPLETED",
      gameId,
      description: `Entry fee for game ${gameId}`,
    },
  })
}

export async function refundEntryFeeInTx(
  tx: DbTx,
  userId: string,
  amount: number,
  gameId: string,
  reason: string
): Promise<boolean> {
  if (await entryFeeRefundExists(tx, userId, gameId, amount)) return false
  await adjustBalanceInTx(tx, userId, amount)
  await tx.transaction.create({
    data: {
      userId,
      type: "REFUND",
      amount: new Decimal(amount),
      status: "COMPLETED",
      gameId,
      description: reason,
    },
  })
  return true
}

/**
 * Credit platform balance after verified TRC-20 USDT deposit.
 * USDT remains on the user's Tron deposit address until withdrawal.
 */
export async function processDeposit(
  userId: string,
  txHash: string,
  amount: number
): Promise<void> {
  if (amount <= 0) throw new Error("Invalid deposit amount")

  const duplicate = await prisma.transaction.findFirst({
    where: { txHash, type: "DEPOSIT", status: "COMPLETED" },
  })
  if (duplicate) {
    throw new Error("Deposit already processed")
  }

  await prisma.$transaction(async (tx) => {
    await adjustBalanceInTx(tx, userId, amount)
    await tx.transaction.create({
      data: {
        userId,
        type: "DEPOSIT",
        amount: new Decimal(amount),
        status: "COMPLETED",
        txHash,
        description: "TRC-20 USDT deposit",
      },
    })
  })
}

/** Confirm deposit: verify on TronGrid then credit ledger. */
export async function confirmDepositByTxHash(
  userId: string,
  txHash: string,
  expectedAmount?: number
): Promise<{ amount: number; txHash: string }> {
  const { address } = await ensureUserDepositWallet(userId)
  const { amount, from } = await verifyUsdtDepositTx(txHash, address)

  if (
    expectedAmount !== undefined &&
    Math.abs(amount - expectedAmount) > 0.000001
  ) {
    throw new Error(
      `On-chain amount is ${amount} USDT but you entered ${expectedAmount}`
    )
  }

  await processDeposit(userId, txHash.trim(), amount)
  return { amount, txHash: txHash.trim() }
}

export async function processWithdrawal(
  userId: string,
  toAddress: string,
  amount: number
): Promise<string> {
  const dest = toAddress.trim()
  if (!isTronBase58Address(dest)) {
    const legacyLedger =
      isLedgerOnlyWalletAddress(dest) && allowLedgerOnlyWithdrawals();
    if (!legacyLedger && !(await validateTronAddress(dest))) {
      throw new Error("Invalid Tron address (must start with T…)")
    }
  }

  if (amount <= 0) throw new Error("Invalid withdrawal amount")

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { walletAddress: true, walletBalance: true },
  })

  if (!user?.walletAddress) {
    throw new Error("User wallet not found")
  }

  const balance = parseFloat(user.walletBalance.toString())
  if (balance < amount) {
    throw new Error("Insufficient balance")
  }

  if (
    isLedgerOnlyWalletAddress(user.walletAddress) &&
    allowLedgerOnlyWithdrawals()
  ) {
    throw new Error(
      "Upgrade your wallet: open the Wallet page once to get a real Tron deposit address."
    )
  }

  const privateKey = await resolveWithdrawalPrivateKey(userId)

  let txHash: string
  try {
    txHash = await transferUSDT(privateKey, dest, amount)
  } catch (error: any) {
    throw new Error(
      error.message ||
        "Transfer failed. Ensure the deposit wallet has TRX for gas (TRON_PRIVATE_KEY hot wallet funds new wallets)."
    )
  }

  await prisma.$transaction(async (tx) => {
    await adjustBalanceInTx(tx, userId, -amount)
    await tx.transaction.create({
      data: {
        userId,
        type: "WITHDRAWAL",
        amount: new Decimal(amount),
        status: "COMPLETED",
        txHash,
        description: `TRC-20 withdrawal to ${dest}`,
      },
    })
  })

  return txHash
}

export async function deductEntryFee(
  userId: string,
  amount: number,
  gameId: string
): Promise<void> {
  if (amount <= 0) return
  await prisma.$transaction(async (tx) => {
    await deductEntryFeeInTx(tx, userId, amount, gameId)
  })
}

export async function processPayout(
  userId: string,
  amount: number,
  gameId: string
): Promise<void> {
  if (amount <= 0) return

  await prisma.$transaction(async (tx) => {
    const existing = await tx.transaction.findFirst({
      where: {
        userId,
        gameId,
        type: "PAYOUT",
        status: "COMPLETED",
      },
    })
    if (existing) return

    await adjustBalanceInTx(tx, userId, amount)
    await tx.transaction.create({
      data: {
        userId,
        type: "PAYOUT",
        amount: new Decimal(amount),
        status: "COMPLETED",
        gameId,
        description: `Payout from game ${gameId}`,
      },
    })
  })
}

export async function processCommission(
  amount: number,
  gameId: string
): Promise<void> {
  if (amount <= 0) return

  const platformUserId = await getPlatformLedgerUserId()

  await prisma.$transaction(async (tx) => {
    const existing = await tx.transaction.findFirst({
      where: {
        gameId,
        type: "COMMISSION",
        status: "COMPLETED",
      },
    })
    if (existing) return

    await adjustBalanceInTx(tx, platformUserId, amount)
    await tx.transaction.create({
      data: {
        userId: platformUserId,
        type: "COMMISSION",
        amount: new Decimal(amount),
        status: "COMPLETED",
        gameId,
        description: `Platform commission for game ${gameId}`,
      },
    })
  })
}
