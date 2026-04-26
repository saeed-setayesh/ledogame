import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-helpers"
import { processWithdrawal } from "@/lib/blockchain/wallet"

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const { toAddress, amount } = await request.json()

    if (!toAddress || !amount) {
      return NextResponse.json(
        { error: "Address and amount are required" },
        { status: 400 }
      )
    }

    const txHash = await processWithdrawal(user.id, toAddress, parseFloat(amount))

    return NextResponse.json({ success: true, txHash })
  } catch (error: any) {
    console.error("Withdrawal error:", error)
    return NextResponse.json(
      { error: error.message || "Withdrawal failed" },
      { status: 500 }
    )
  }
}

