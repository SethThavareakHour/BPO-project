import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DashboardClientPage } from "./client"

export default async function DashboardPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return <DashboardClientPage userName={session.user.name ?? "Advisor"} />
}
