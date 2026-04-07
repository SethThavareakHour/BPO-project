"use client"

import {
  FolderKanban,
  Users,
  Clock,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
} from "lucide-react"
import Link from "next/link"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn, formatDate, timeAgo } from "@/lib/utils"
import type { DashboardStats } from "@/types"

// ─────────────────────────────────────────────
// Single stat card
// ─────────────────────────────────────────────
interface StatCardProps {
  title: string
  value: number
  description: string
  icon: React.ElementType
  iconColor: string
  iconBg: string
  trend?: string
  href?: string
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  iconColor,
  iconBg,
  href,
}: StatCardProps) {
  const content = (
    <Card
      className={cn(
        "relative overflow-hidden border border-gray-100/60 transition-all duration-300 group",
        "bg-white rounded-xl shadow-[0_4px_20px_-6px_rgba(0,0,0,0.05)] hover:shadow-[0_15px_40px_-10px_rgba(0,0,0,0.12)] hover:-translate-y-0.5",
        href && "cursor-pointer hover:border-blue-200"
      )}
    >
      <Link href={href || "#"} className={cn("block p-2.5", !href && "pointer-events-none")}>
        <div className="flex items-center gap-3">
          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105", iconBg)}>
            <Icon className={cn("h-4 w-4", iconColor)} strokeWidth={2.5} />
          </div>

          <div className="flex-1 min-w-0 px-0.5">
            <p className="text-[11px] font-black text-gray-400 mb-0.5 tracking-wider uppercase truncate leading-none">
              {title}
            </p>
            <span className="text-2xl font-black tracking-tight text-gray-900 leading-none">
              {value.toLocaleString()}
            </span>
          </div>

          {href && (
            <div className="h-5 w-5 shrink-0 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-all">
              <ArrowRight className="h-2.5 w-2.5 group-hover:-rotate-45 transition-transform" />
            </div>
          )}
        </div>
      </Link>
    </Card>
  )

  return content;
}

// ─────────────────────────────────────────────
// Skeleton loader
// ─────────────────────────────────────────────
function StatCardSkeleton() {
  return (
    <Card className="border-0 shadow-sm rounded-2xl bg-white">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-10 w-10 rounded-xl" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16 mb-2" />
        <Skeleton className="h-3 w-24" />
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────
// Recent reviews list
// ─────────────────────────────────────────────
function RecentReviewsList({
  reviews,
}: {
  reviews: DashboardStats["recentReviews"]
}) {
  if (reviews.length === 0) {
    return (
      <Card className="h-full border border-gray-100/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] rounded-[24px] bg-white flex flex-col">
        <CardHeader className="pb-4 pt-6 px-7 shrink-0">
          <CardTitle className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-blue-500" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center pb-7 px-7">
          <div className="w-full flex flex-col items-center justify-center py-12 text-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-200 h-full">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[18px] bg-white shadow-sm border border-gray-100">
              <Clock className="h-6 w-6 text-gray-300" />
            </div>
            <p className="text-sm font-bold text-gray-700">No activity yet</p>
            <p className="mt-1.5 text-[13px] text-gray-400 max-w-[240px]">
              Generate an AI review for a document to see activity here.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full border border-gray-100/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] rounded-[24px] bg-white overflow-hidden flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-4 pt-6 px-7 shrink-0">
        <CardTitle className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
          Recent Activity
        </CardTitle>
        <Link
          href="/reviews"
          className="text-[13px] text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 transition-all hover:gap-1.5"
        >
          View all reviews
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>

      <CardContent className="px-3 pb-3 flex-1 overflow-auto">
        <div className="h-full rounded-2xl border border-gray-100 overflow-hidden">
          <ul className="divide-y divide-gray-50">
            {reviews.map((review) => (
              <li key={review.id} className="group/item">
                <Link
                  href={`/reviews/${review.id}`}
                  className="flex items-center gap-4 px-4 py-3 transition-all hover:bg-gray-50/80"
                >
                  {/* Type badge */}
                  <div className="shrink-0 flex items-center justify-center h-9 w-9 rounded-xl bg-gray-100/50 group-hover/item:bg-white border text-[10px] font-black tracking-wide transition-colors shrink-0">
                    <span
                      className={cn(
                        review.documentType === "SRS" ? "text-blue-600" : "text-violet-600"
                      )}
                    >
                      {review.documentType}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-bold text-gray-900 group-hover/item:text-blue-600 transition-colors">
                      {review.documentName}
                    </p>
                    <p className="truncate text-xs text-gray-400 font-medium mt-0.5 flex items-center gap-1.5">
                      <FolderKanban className="h-2.5 w-2.5" />
                      {review.projectName}
                    </p>
                  </div>

                  {/* Status + Time */}
                  <div className="shrink-0 flex flex-col items-end justify-center">
                    <Badge
                      variant="outline"
                      className={cn(
                        "mb-1.5 text-[11px] font-bold border-0 px-2.5 py-1 rounded-lg",
                        review.isApproved
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      )}
                    >
                      {review.isApproved ? "Approved" : "Reviewed"}
                    </Badge>
                    <p className="text-[11px] font-medium text-gray-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {timeAgo(review.createdAt)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────
// Recent Reviews Skeleton
// ─────────────────────────────────────────────
function RecentReviewsSkeleton() {
  return (
    <Card className="border-0 shadow-sm rounded-2xl bg-white">
      <CardHeader className="pb-3">
        <Skeleton className="h-4 w-36" />
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="h-5 w-9 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <div className="space-y-1 text-right">
              <Skeleton className="h-4 w-16 ml-auto" />
              <Skeleton className="h-3 w-12 ml-auto" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────
// Main Export — StatsCards
// ─────────────────────────────────────────────
interface StatsCardsProps {
  stats: DashboardStats | null
  isLoading?: boolean
}

export function StatsCards({ stats, isLoading = false }: StatsCardsProps) {
  if (isLoading || !stats) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
        <RecentReviewsSkeleton />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-y-8 lg:gap-x-8">
      {/* ── Left Column: Stat Cards (Height-Aligned) ────────────────── */}
      <div className="lg:col-span-3 h-full flex flex-col justify-between gap-4">
        <StatCard
          title="Total Projects"
          value={stats.totalProjects}
          description="Student projects managed"
          icon={FolderKanban}
          iconColor="text-[#113F67]"
          iconBg="bg-[#113F67]/10"
          href="/projects"
        />

        <StatCard
          title="Total Students"
          value={stats.totalStudents}
          description="Across all projects"
          icon={Users}
          iconColor="text-[#34699A]"
          iconBg="bg-[#34699A]/10"
          href="/projects"
        />

        <StatCard
          title="Pending Reviews"
          value={stats.pendingReviews}
          description="Documents awaiting review"
          icon={Clock}
          iconColor="text-[#58A0C8]"
          iconBg="bg-[#58A0C8]/15"
          href="/reviews?status=PENDING"
        />

        <StatCard
          title="Approved"
          value={stats.approvedDocuments}
          description="Documents approved"
          icon={CheckCircle2}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-100"
          href="/reviews?status=APPROVED"
        />
      </div>

      {/* ── Right Column: Recent activity ───────────────────────────── */}
      <div className="lg:col-span-9 h-full">
        <RecentReviewsList reviews={stats.recentReviews} />
      </div>
    </div>
  )
}
