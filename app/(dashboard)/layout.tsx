import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard/header"
import { Providers } from "@/components/providers"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <Providers>
      <div className="min-h-screen flex flex-col bg-[#f6f8fb]">
        {/* ── Header Navigation ───────────────────────────────────────── */}
        <DashboardHeader
          user={{
            name: session.user.name ?? "Advisor",
            email: session.user.email ?? "",
          }}
        />

        {/* ── Main content area ─────────────────────────────────────── */}
        <main className="flex-1 w-full pb-12 animate-fade-in">
          {children}
        </main>
      </div>
    </Providers>
  )
}
