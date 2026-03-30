import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/dashboard/sidebar"
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
      <div className="flex h-screen overflow-hidden bg-gray-50">
        {/* ── Sidebar ──────────────────────────────────────────────── */}
        <Sidebar
          user={{
            name: session.user.name ?? "Advisor",
            email: session.user.email ?? "",
          }}
        />

        {/* ── Main content area ─────────────────────────────────────── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </Providers>
  )
}
