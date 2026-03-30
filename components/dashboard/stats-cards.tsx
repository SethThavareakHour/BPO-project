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
        "relative overflow-hidden transition-shadow",
        href && "hover:shadow-md cursor-pointer"
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">
          {title}
        </CardTitle>
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", iconBg)}>
          <Icon className={cn("h-5 w-5", iconColor)} />
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-bold tracking-tight text-gray-900">
              {value.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-gray-500">{description}</p>
          </div>

          {href && (
            <ArrowRight className="mb-1 h-4 w-4 text-gray-300 transition-transform group-hover:translate-x-0.5" />
          )}
        </div>
      </CardContent>
    </Card>
  )

  if (href) {
    return (
      <Link href={href} className="group block">
        {content}
      </Link>
    )
  }

  return content
}

// ─────────────────────────────────────────────
// Skeleton loader
// ─────────────────────────────────────────────
function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-9 rounded-lg" />
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
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-indigo-500" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <Clock className="h-6 w-6 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-600">No reviews yet</p>
            <p className="mt-1 text-xs text-gray-400">
              Generate an AI review for a document to see activity here.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-indigo-500" />
          Recent Activity
        </CardTitle>
        <Link
          href="/reviews"
          className="text-xs text-indigo-600 hover:text-indigo-700 hover:underline font-medium"
        >
          View all
        </Link>
      </CardHeader>

      <CardContent className="px-0 pb-0">
        <ul className="divide-y divide-gray-100">
          {reviews.map((review) => (
            <li key={review.id}>
              <Link
                href={`/reviews/${review.id}`}
                className="flex items-start gap-3 px-6 py-3 transition-colors hover:bg-gray-50"
              >
                {/* Type badge */}
                <div className="mt-0.5 shrink-0">
                  <span
                    className={cn(
                      "inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                      review.documentType === "SRS"
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-violet-100 text-violet-700"
                    )}
                  >
                    {review.documentType}
                  </span>
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {review.documentName}
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    {review.projectName}
                  </p>
                </div>

                {/* Status + Time */}
                <div className="shrink-0 text-right">
                  <Badge
                    variant="outline"
                    className={cn(
                      "mb-1 text-[10px]",
                      review.isApproved
                        ? "border-green-200 bg-green-50 text-green-700"
                        : "border-amber-200 bg-amber-50 text-amber-700"
                    )}
                  >
                    {review.isApproved ? "Approved" : "Reviewed"}
                  </Badge>
                  <p className="text-[10px] text-gray-400">
                    {timeAgo(review.createdAt)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        {reviews.length > 0 && (
          <div className="border-t px-6 py-3">
            <p className="text-[11px] text-gray-400">
              Last updated: {formatDate(reviews[0].createdAt)}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────
// Recent Reviews Skeleton
// ─────────────────────────────────────────────
function RecentReviewsSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <Skeleton className="h-4 w-36" />
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="h-5 w-9 rounded" />
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
        <RecentReviewsSkeleton />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Stat cards grid ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Projects"
          value={stats.totalProjects}
          description="Student projects managed"
          icon={FolderKanban}
          iconColor="text-indigo-600"
          iconBg="bg-indigo-50"
          href="/projects"
        />

        <StatCard
          title="Total Students"
          value={stats.totalStudents}
          description="Across all projects"
          icon={Users}
          iconColor="text-violet-600"
          iconBg="bg-violet-50"
          href="/projects"
        />

        <StatCard
          title="Pending Reviews"
          value={stats.pendingReviews}
          description="Documents awaiting review"
          icon={Clock}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
          href="/reviews?status=PENDING"
        />

        <StatCard
          title="Approved"
          value={stats.approvedDocuments}
          description="Documents approved"
          icon={CheckCircle2}
          iconColor="text-green-600"
          iconBg="bg-green-50"
          href="/reviews?status=APPROVED"
        />
      </div>

      {/* ── Recent activity ────────────────────────────────────────── */}
      <RecentReviewsList reviews={stats.recentReviews} />
    </div>
  )
}
