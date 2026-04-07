"use client"

import { useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"

import { StatsCards } from "@/components/dashboard/stats-cards"
import { Button } from "@/components/ui/button"
import { fetcher } from "@/lib/utils"
import type { DashboardStats, ApiSuccess } from "@/types"

interface DashboardClientPageProps {
  userName: string
}

export function DashboardClientPage({ userName }: DashboardClientPageProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  async function loadStats(showRefreshing = false) {
    if (showRefreshing) setIsRefreshing(true)
    else setIsLoading(true)

    try {
      const res = await fetcher<ApiSuccess<DashboardStats>>("/api/dashboard")
      setStats(res.data)
    } catch (err) {
      console.error("Failed to load dashboard stats:", err)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  // ── Greeting ──────────────────────────────────────────────────────────
  function getGreeting(): string {
    const hour = new Date().getHours()
    if (hour < 12) return "Good morning"
    if (hour < 18) return "Good afternoon"
    return "Good evening"
  }

  return (
    <div className="p-6 max-w-7xl mx-auto w-full space-y-6 animate-fade-in-up">
      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            <span suppressHydrationWarning>{getGreeting()}</span>, {userName.split(" ")[0]} 👋
          </h1>
          <p className="mt-1.5 text-sm text-gray-400">
            Here&apos;s an overview of your projects and document reviews.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => loadStats(true)}
          disabled={isRefreshing || isLoading}
          className="shrink-0 rounded-xl border-gray-200 hover:bg-gray-50 text-gray-600"
        >
          <RefreshCw
            className={`mr-2 h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* ── Stats cards ──────────────────────────────────────────────── */}
      <StatsCards stats={stats} isLoading={isLoading} />
    </div>
  )
}
