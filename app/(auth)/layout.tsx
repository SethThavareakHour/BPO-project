import type { Metadata } from "next"
import Link from "next/link"
import { BookOpen } from "lucide-react"

export const metadata: Metadata = {
  title: {
    template: "%s | Technical BPO",
    default: "Technical BPO",
  },
  description: "Advisor Review System — SRS & OPPM document review platform",
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#f6f8fb] flex flex-col">
      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-6 py-5">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-md shadow-blue-200 transition-transform group-hover:scale-105">
            <BookOpen className="h-[18px] w-[18px] text-white" />
          </div>
          <div className="leading-tight">
            <p className="text-[15px] font-bold text-gray-900 tracking-tight">Technical BPO</p>
          </div>
        </Link>
      </header>

      {/* ── Centered content ─────────────────────────────────────────── */}
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">{children}</div>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="py-4 text-center text-xs text-gray-400">
        &copy; <span suppressHydrationWarning>{new Date().getFullYear()}</span> Technical BPO. All rights reserved.
      </footer>
    </div>
  )
}
