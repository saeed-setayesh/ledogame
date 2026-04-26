import { auth } from "@/app/api/auth/[...nextauth]/route"
import { redirect } from "next/navigation"

export async function getCurrentUser() {
  try {
    const session = await auth()
    return session?.user || null
  } catch (error) {
    return null
  }
}

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/auth/signin")
  }
  return user
}

export async function requireAdmin() {
  const user = await requireAuth()
  const { prisma } = await import("./prisma")
  
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isAdmin: true }
  })

  if (!dbUser?.isAdmin) {
    redirect("/")
  }

  return user
}

