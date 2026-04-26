import TronWeb from "tronweb"

// USDT TRC-20 contract address
const USDT_CONTRACT_ADDRESS = process.env.TRON_NETWORK === "mainnet"
  ? "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" // Mainnet USDT
  : "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf" // Shasta testnet USDT

let tronWeb: TronWeb | null = null

export function getTronWeb(): TronWeb {
  if (!tronWeb) {
    const network = process.env.TRON_NETWORK || "shasta"
    const fullNode = network === "mainnet"
      ? "https://api.trongrid.io"
      : "https://api.shasta.trongrid.io"
    const solidityNode = network === "mainnet"
      ? "https://api.trongrid.io"
      : "https://api.shasta.trongrid.io"
    const eventServer = network === "mainnet"
      ? "https://api.trongrid.io"
      : "https://api.shasta.trongrid.io"

    tronWeb = new TronWeb({
      fullHost: fullNode,
      solidityNode,
      eventServer,
      headers: process.env.TRON_API_KEY
        ? { "TRON-PRO-API-KEY": process.env.TRON_API_KEY }
        : undefined,
    })
  }
  return tronWeb
}

export async function createWallet(): Promise<{ address: string; privateKey: string }> {
  const tronWeb = getTronWeb()
  const account = await tronWeb.createAccount()
  return {
    address: account.address.base58,
    privateKey: account.privateKey,
  }
}

export async function getUSDTBalance(address: string): Promise<number> {
  try {
    const tronWeb = getTronWeb()
    const contract = await tronWeb.contract().at(USDT_CONTRACT_ADDRESS)
    const balance = await contract.balanceOf(address).call()
    // USDT has 6 decimals
    return balance.toNumber() / 1000000
  } catch (error) {
    console.error("Error getting USDT balance:", error)
    return 0
  }
}

export async function transferUSDT(
  fromPrivateKey: string,
  toAddress: string,
  amount: number
): Promise<string> {
  try {
    const tronWeb = getTronWeb()
    const contract = await tronWeb.contract().at(USDT_CONTRACT_ADDRESS)
    
    // Amount in smallest unit (6 decimals)
    const amountInSun = Math.floor(amount * 1000000)
    
    // Set private key for signing
    tronWeb.setPrivateKey(fromPrivateKey)
    
    // Transfer
    const transaction = await contract.transfer(toAddress, amountInSun).send()
    
    return transaction
  } catch (error: any) {
    console.error("Error transferring USDT:", error)
    throw new Error(`Transfer failed: ${error.message}`)
  }
}

export async function getTransactionInfo(txHash: string): Promise<any> {
  try {
    const tronWeb = getTronWeb()
    const tx = await tronWeb.trx.getTransactionInfo(txHash)
    return tx
  } catch (error) {
    console.error("Error getting transaction info:", error)
    return null
  }
}

export async function validateAddress(address: string): Promise<boolean> {
  try {
    const tronWeb = getTronWeb()
    return tronWeb.isAddress(address)
  } catch {
    return false
  }
}

export function getUSDTContractAddress(): string {
  return USDT_CONTRACT_ADDRESS
}

