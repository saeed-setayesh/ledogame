"use client"

import { SessionProvider } from "next-auth/react"
import CapacitorVideoSplash from "@/components/native/CapacitorVideoSplash"
import NativeAppShell from "@/components/native/NativeAppShell"

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <CapacitorVideoSplash>
        <NativeAppShell>{children}</NativeAppShell>
      </CapacitorVideoSplash>
    </SessionProvider>
  )
}

