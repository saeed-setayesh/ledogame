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
    const msg = error?.message || "Withdrawal failed"
    // Validation / balance problems are the caller's fault → 400, not 500.
    const isUserError =
      /invalid|insufficient|address|amount|balance|minimum|maximum/i.test(msg)
    return NextResponse.json({ error: msg }, { status: isUserError ? 400 : 500 })
  }
}

