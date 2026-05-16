import { prisma } from "@/lib/prisma"
import { createWallet, getUSDTBalance, transferUSDT } from "./tron"
import { validateBep20Address } from "./bep20"
import { Decimal } from "@prisma/client/runtime/library"

export async function createUserWallet(userId: string): Promise<string> {
  // Check if user already has a wallet
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { walletAddress: true }
  })

  if (user?.walletAddress) {
    return user.walletAddress
  }

  // Create new wallet
  const { address, privateKey } = await createWallet()

  // Store wallet address (private key should be stored securely, encrypted)
  // For production, use a secure key management service
  await prisma.user.update({
    where: { id: userId },
    data: { walletAddress: address }
  })

  // TODO: Store private key securely (encrypted in database or use a key management service)
  // For now, we'll need to handle this properly in production

  return address
}

export async function syncWalletBalance(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { walletAddress: true }
  })

  if (!user?.walletAddress) {
    await createUserWallet(userId)
    return 0
  }

  if (user.walletAddress.startsWith("0x")) {
    const row = await prisma.user.findUnique({
      where: { id: userId },
      select: { walletBalance: true },
    })
    return row ? parseFloat(row.walletBalance.toString()) : 0
  }

  const balance = await getUSDTBalance(user.walletAddress)

  // Update balance in database
  await prisma.user.update({
    where: { id: userId },
    data: { walletBalance: new Decimal(balance) }
  })

  return balance
}

export async function processDeposit(
  userId: string,
  txHash: string,
  amount: number
): Promise<void> {
  // Verify transaction on blockchain
  // In production, you should verify the transaction actually happened
  // and came from the user's wallet

  await prisma.$transaction(async (tx) => {
    // Create transaction record
    await tx.transaction.create({
      data: {
        userId,
        type: "DEPOSIT",
        amount: new Decimal(amount),
        status: "COMPLETED",
        txHash,
        description: "Deposit from external wallet",
      }
    })

    // Update user balance
    await syncWalletBalance(userId)
  })
}

export async function processWithdrawal(
  userId: string,
  toAddress: string,
  amount: number
): Promise<string> {
  // Validate address
  if (!validateBep20Address(toAddress)) {
    throw new Error("Invalid BEP20 address (use 0x… on BNB Smart Chain)")
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { walletAddress: true, walletBalance: true }
  })

  if (!user?.walletAddress) {
    throw new Error("User wallet not found")
  }

  const balance = parseFloat(user.walletBalance.toString())
  if (balance < amount) {
    throw new Error("Insufficient balance")
  }

  // Get user's private key (in production, retrieve from secure storage)
  // For now, this is a placeholder - you need to implement secure key retrieval
  const privateKey = process.env[`WALLET_KEY_${userId}`] // This is just an example
  if (!privateKey) {
    throw new Error("Wallet private key not found")
  }

  // Transfer USDT
  const txHash = await transferUSDT(privateKey, toAddress, amount)

  await prisma.$transaction(async (tx) => {
    // Create transaction record
    await tx.transaction.create({
      data: {
        userId,
        type: "WITHDRAWAL",
        amount: new Decimal(amount),
        status: "PENDING",
        txHash,
        description: `Withdrawal to ${toAddress}`,
      }
    })

    // Update user balance
    await syncWalletBalance(userId)
  })

  return txHash
}

export async function deductEntryFee(
  userId: string,
  amount: number,
  gameId: string
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { walletBalance: true }
  })

  if (!user) {
    throw new Error("User not found")
  }

  const balance = parseFloat(user.walletBalance.toString())
  if (balance < amount) {
    throw new Error("Insufficient balance")
  }

  await prisma.$transaction(async (tx) => {
    // Deduct from balance
    await tx.user.update({
      where: { id: userId },
      data: {
        walletBalance: new Decimal(balance - amount)
      }
    })

    // Create transaction record
    await tx.transaction.create({
      data: {
        userId,
        type: "ENTRY_FEE",
        amount: new Decimal(amount),
        status: "COMPLETED",
        gameId,
        description: `Entry fee for game ${gameId}`,
      }
    })
  })
}

export async function processPayout(
  userId: string,
  amount: number,
  gameId: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Get current balance
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { walletBalance: true }
    })

    if (!user) {
      throw new Error("User not found")
    }

    const currentBalance = parseFloat(user.walletBalance.toString())

    // Add to balance
    await tx.user.update({
      where: { id: userId },
      data: {
        walletBalance: new Decimal(currentBalance + amount)
      }
    })

    // Create transaction record
    await tx.transaction.create({
      data: {
        userId,
        type: "PAYOUT",
        amount: new Decimal(amount),
        status: "COMPLETED",
        gameId,
        description: `Payout from game ${gameId}`,
      }
    })
  })
}

