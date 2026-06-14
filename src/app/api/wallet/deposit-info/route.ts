import { NextResponse } from "next/server";
import { getLudinoWalletInfo } from "@/lib/wallet/ludino-wallet";
import { getBscNetworkLabel, getBscScanBaseUrl } from "@/lib/blockchain/bsc-network";
import { getDepositInstructions } from "@/lib/blockchain/bsc";

/** Public deposit info for testing (no secrets). */
export async function GET() {
  try {
    const ludino = getLudinoWalletInfo();
    const instructions = getDepositInstructions();

    return NextResponse.json({
      ready: true,
      depositAddress: ludino.address,
      network: ludino.network,
      networkLabel: getBscNetworkLabel(),
      usdtContract: instructions.usdtContract,
      explorerUrl: `${getBscScanBaseUrl()}/address/${ludino.address}`,
      withdrawalsEnabled: ludino.hasPrivateKey,
      instructions: [
        "Send USDT (BEP20) on BNB Smart Chain to the deposit address.",
        "Open Wallet in the app, paste the transaction hash, and confirm.",
        "Or use Scan for deposits (optionally enter your sending 0x address).",
      ],
    });
  } catch (error: any) {
    return NextResponse.json({
      ready: false,
      error: error.message || "Wallet not configured",
    });
  }
}
