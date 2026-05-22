"use client"

import { SessionProvider } from "next-auth/react"
import CapacitorVideoSplash from "@/components/native/CapacitorVideoSplash"

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <CapacitorVideoSplash>{children}</CapacitorVideoSplash>
    </SessionProvider>
  )
}

