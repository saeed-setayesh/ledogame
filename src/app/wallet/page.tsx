import { getCurrentUser } from "@/lib/auth-helpers"
import { redirect } from "next/navigation"
import WalletDashboard from "@/components/wallet/WalletDashboard"

export default async function WalletPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth/signin")
  }

  return (
    <div className="game-bg p-4">
      <div className="max-w-2xl mx-auto">
        <WalletDashboard userId={user.id} />
      </div>
    </div>
  )
}

