import { getCurrentUser } from "@/lib/auth-helpers"
import { redirect } from "next/navigation"
import Lobby from "@/components/game/Lobby"

export default async function LobbyPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth/signin")
  }

  return <Lobby userId={user.id} />
}

