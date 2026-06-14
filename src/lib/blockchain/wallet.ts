import { prisma } from "@/lib/prisma"
import { transferUsdt, verifyBep20UsdtDeposit, getUsdtBalance } from "./bsc"
import { validateBep20Address } from "./bep20"
import { Decimal } from "@prisma/client/runtime/library"
import type { Prisma } from "@prisma/client"
import {
  allowLedgerOnlyWithdrawals,
  allowMockDeposits,
  getCommissionRateFraction,
  getCommissionRatePercent,
} from "@/lib/wallet/config"
import { getPlatformLedgerUserId } from "@/lib/wallet/platform-user"
import {
  getLudinoUsdtAddress,
  getLudinoWalletPrivateKey,
  requireLudinoWalletPrivateKey,
} from "@/lib/wallet/ludino-wallet"

export { getCommissionRateFraction, getCommissionRatePercent }

type DbTx = Prisma.TransactionClient

/** Platform play balance (ledger). */
export async function getUserLedgerBalance(userId: string): Promise<number> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { walletBalance: true },
  })
  return row ? parseFloat(row.walletBalance.toString()) : 0
}

/** Ludino hot wallet on-chain USDT (informational). */
export async function getLudinoOnChainUsdtBalance(): Promise<number> {
  return getUsdtBalance(getLudinoUsdtAddress())
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

/** Credit platform balance after verified BEP20 USDT deposit to Ludino wallet. */
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
        description: "BEP20 USDT deposit (BSC)",
      },
    })
  })
}

/** Verify BEP20 transfer to Ludino wallet on BSC, then credit ledger. */
export async function confirmDepositByTxHash(
  userId: string,
  txHash: string,
  expectedAmount?: number
): Promise<{ amount: number; txHash: string; from: string }> {
  const ludino = getLudinoUsdtAddress()
  const { amount, from } = await verifyBep20UsdtDeposit(txHash, ludino)

  if (
    expectedAmount !== undefined &&
    Math.abs(amount - expectedAmount) > 0.000001
  ) {
    throw new Error(
      `On-chain amount is ${amount} USDT but you entered ${expectedAmount}`
    )
  }

  await processDeposit(userId, txHash.trim(), amount)
  await prisma.user.update({
    where: { id: userId },
    data: { walletAddress: from },
  })
  return { amount, txHash: txHash.trim(), from }
}

export async function processWithdrawal(
  userId: string,
  toAddress: string,
  amount: number
): Promise<string> {
  const dest = toAddress.trim()
  if (!validateBep20Address(dest)) {
    throw new Error("Invalid BEP20 address (use 0x… on BNB Smart Chain)")
  }
  if (amount <= 0) throw new Error("Invalid withdrawal amount")

  const balance = await getUserLedgerBalance(userId)
  if (balance < amount) {
    throw new Error("Insufficient balance")
  }

  if (allowLedgerOnlyWithdrawals() && !getLudinoWalletPrivateKey()) {
    const txHash = `ledger_${Date.now()}_${userId.slice(0, 8)}`
    await prisma.$transaction(async (tx) => {
      await adjustBalanceInTx(tx, userId, -amount)
      await tx.transaction.create({
        data: {
          userId,
          type: "WITHDRAWAL",
          amount: new Decimal(amount),
          status: "COMPLETED",
          txHash,
          description: `Ledger withdrawal to ${dest} (no BSC_PRIVATE_KEY)`,
        },
      })
    })
    return txHash
  }

  const privateKey = requireLudinoWalletPrivateKey()
  let txHash: string
  try {
    txHash = await transferUsdt(privateKey, dest, amount)
  } catch (error: any) {
    throw new Error(
      error.message ||
        "Transfer failed. Ensure Ludino wallet has enough USDT and BNB for gas."
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
        description: `BEP20 withdrawal to ${dest}`,
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
