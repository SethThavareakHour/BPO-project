import type { Metadata } from "next"
import Link from "next/link"
import { BookOpen } from "lucide-react"

export const metadata: Metadata = {
  title: {
    template: "%s | AdvisorDesk",
    default: "AdvisorDesk",
  },
  description: "Advisor Review System — SRS & OPPM document review platform",
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50 flex flex-col">
      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <header className="flex items-center gap-2.5 px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 shadow-sm transition-transform group-hover:scale-105">
            <BookOpen className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold text-gray-900">AdvisorDesk</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">
              Review System
            </p>
          </div>
        </Link>
      </header>

      {/* ── Centered content ─────────────────────────────────────────── */}
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">{children}</div>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="py-4 text-center text-xs text-gray-400">
        &copy; {new Date().getFullYear()} AdvisorDesk. All rights reserved.
      </footer>
    </div>
  )
}
