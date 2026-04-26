import { requireAdmin } from "@/lib/auth-helpers"
import { redirect } from "next/navigation"
import AdminDashboard from "@/components/admin/Dashboard"

export default async function AdminPage() {
  try {
    await requireAdmin()
    return <AdminDashboard />
  } catch {
    redirect("/")
  }
}

