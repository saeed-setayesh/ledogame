/**
 * Mock wallet service for development/testing
 * Generates fake BEP20 (BNB Smart Chain) addresses, tx hashes, and simulates wallet operations
 */

export interface MockTransaction {
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amount: number;
  timestamp: Date;
  status: "pending" | "completed" | "failed";
}

/**
 * Generate a fake BEP20 address (0x + 40 hex chars)
 */
export function generateMockAddress(): string {
  const chars = "0123456789abcdef";
  let hex = "";
  for (let i = 0; i < 40; i++) {
    hex += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `0x${hex}`;
}

/**
 * Generate a fake transaction hash (64 character hex string)
 */
export function generateMockTxHash(): string {
  const chars = "0123456789abcdef";
  let hash = "";
  for (let i = 0; i < 64; i++) {
    hash += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return hash;
}

/**
 * Get mock balance for a user (stored in localStorage for persistence)
 */
export function getMockBalance(userId: string): number {
  if (typeof window === "undefined") return 0;

  const stored = localStorage.getItem(`mock_balance_${userId}`);
  if (stored) {
    return parseFloat(stored);
  }

  // Default starting balance
  const defaultBalance = 100.0;
  setMockBalance(userId, defaultBalance);
  return defaultBalance;
}

/**
 * Set mock balance for a user
 */
export function setMockBalance(userId: string, balance: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(`mock_balance_${userId}`, balance.toString());
}

/**
 * Get mock wallet address for a user
 */
export function getMockAddress(userId: string): string {
  if (typeof window === "undefined") return generateMockAddress();

  const stored = localStorage.getItem(`mock_address_${userId}`);
  if (stored) {
    return stored;
  }

  const address = generateMockAddress();
  localStorage.setItem(`mock_address_${userId}`, address);
  return address;
}

/**
 * Simulate a deposit transaction
 */
export function simulateDeposit(
  userId: string,
  amount: number,
  txHash?: string
): { success: boolean; txHash: string; newBalance: number } {
  const currentBalance = getMockBalance(userId);
  const newBalance = currentBalance + amount;
  setMockBalance(userId, newBalance);

  const hash = txHash || generateMockTxHash();

  // Store transaction in localStorage
  const transactions = getMockTransactions(userId);
  transactions.unshift({
    txHash: hash,
    fromAddress: generateMockAddress(),
    toAddress: getMockAddress(userId),
    amount,
    timestamp: new Date(),
    status: "completed",
  });
  saveMockTransactions(userId, transactions);

  return {
    success: true,
    txHash: hash,
    newBalance,
  };
}

/**
 * Simulate a withdrawal transaction
 */
export function simulateWithdrawal(
  userId: string,
  toAddress: string,
  amount: number
): { success: boolean; txHash: string; newBalance: number } {
  const currentBalance = getMockBalance(userId);

  if (currentBalance < amount) {
    return {
      success: false,
      txHash: "",
      newBalance: currentBalance,
    };
  }

  const newBalance = currentBalance - amount;
  setMockBalance(userId, newBalance);

  const hash = generateMockTxHash();

  // Store transaction in localStorage
  const transactions = getMockTransactions(userId);
  transactions.unshift({
    txHash: hash,
    fromAddress: getMockAddress(userId),
    toAddress,
    amount,
    timestamp: new Date(),
    status: "completed",
  });
  saveMockTransactions(userId, transactions);

  return {
    success: true,
    txHash: hash,
    newBalance,
  };
}

/**
 * Get mock transactions for a user
 */
export function getMockTransactions(userId: string): MockTransaction[] {
  if (typeof window === "undefined") return [];

  const stored = localStorage.getItem(`mock_transactions_${userId}`);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return parsed.map((t: any) => ({
        ...t,
        timestamp: new Date(t.timestamp),
      }));
    } catch {
      return [];
    }
  }

  return [];
}

/**
 * Save mock transactions for a user
 */
function saveMockTransactions(
  userId: string,
  transactions: MockTransaction[]
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    `mock_transactions_${userId}`,
    JSON.stringify(transactions)
  );
}

/**
 * Generate QR code data URL for an address
 */
export function generateQRCodeData(address: string): string {
  // In a real implementation, you'd use a QR code library
  // For now, return a data URL placeholder
  // You can use libraries like 'qrcode' or 'qrcode.react' in the component
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
    address
  )}`;
}

/**
 * Add a mock transaction (for entry fees, payouts, etc.)
 */
export function addMockTransaction(
  userId: string,
  type: "deposit" | "withdrawal" | "entry_fee" | "payout",
  amount: number,
  description?: string
): void {
  const transactions = getMockTransactions(userId);
  const userAddress = getMockAddress(userId);

  let fromAddress = userAddress;
  let toAddress = userAddress;

  if (type === "deposit") {
    fromAddress = generateMockAddress();
    toAddress = userAddress;
  } else if (type === "withdrawal") {
    fromAddress = userAddress;
    toAddress = generateMockAddress();
  }

  transactions.unshift({
    txHash: generateMockTxHash(),
    fromAddress,
    toAddress,
    amount,
    timestamp: new Date(),
    status: "completed",
  });

  // Keep only last 100 transactions
  if (transactions.length > 100) {
    transactions.splice(100);
  }

  saveMockTransactions(userId, transactions);
}
