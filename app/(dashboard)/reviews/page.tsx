"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  FileSearch,
  Clock,
  CheckCircle2,
  Eye,
  Search,
  Filter,
  RefreshCw,
  FileText,
  AlertCircle,
} from "lucide-react";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, formatDate, timeAgo } from "@/lib/utils";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface ReviewListItem {
  id: string;
  documentId: string;
  document: {
    id: string;
    name: string;
    type: "SRS" | "OPPM" | "UNKNOWN";
    driveUrl: string | null;
    mimeType: string | null;
    status: "PENDING" | "REVIEWING" | "REVIEWED" | "APPROVED";
    projectId: string;
    createdAt: string;
    updatedAt: string;
    project: {
      id: string;
      name: string;
    };
  };
  aiSummary: {
    overallScore: number | null;
    documentType: string | null;
    summary: string | null;
    flaggedCount: number;
    missingSectionCount: number;
  } | null;
  feedback: string | null;
  feedbackType: "AI_GENERATED" | "MANUAL" | null;
  isApproved: boolean;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ReviewsResponse {
  data: ReviewListItem[];
  meta: {
    total: number;
    totalPending: number;
    totalReviewed: number;
    totalApproved: number;
  };
}

type StatusFilter = "ALL" | "PENDING" | "REVIEWED" | "APPROVED";
type TypeFilter = "ALL" | "SRS" | "OPPM";

// ─────────────────────────────────────────────
// Score ring / circle
// ─────────────────────────────────────────────
function ScoreCircle({ score }: { score: number | null }) {
  if (score === null) return null;

  const color =
    score >= 75
      ? "text-green-600 bg-green-50 border-green-200"
      : score >= 40
        ? "text-amber-600 bg-amber-50 border-amber-200"
        : "text-red-600 bg-red-50 border-red-200";

  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold",
        color,
      )}
      title={`Overall AI score: ${score}/100`}
    >
      {score}
    </div>
  );
}

// ─────────────────────────────────────────────
// Document type badge
// ─────────────────────────────────────────────
function DocTypeBadge({ type }: { type: ReviewListItem["document"]["type"] }) {
  if (type === "SRS") {
    return (
      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-indigo-100 text-indigo-700">
        SRS
      </span>
    );
  }
  if (type === "OPPM") {
    return (
      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-violet-100 text-violet-700">
        OPPM
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-gray-100 text-gray-500">
      ?
    </span>
  );
}

// ─────────────────────────────────────────────
// Review card
// ─────────────────────────────────────────────
function ReviewCard({ review }: { review: ReviewListItem }) {
  const doc = review.document;

  const statusBadge = review.isApproved ? (
    <Badge
      variant="outline"
      className="gap-1 border-green-200 bg-green-50 text-green-700 text-[11px]"
    >
      <CheckCircle2 className="h-3 w-3" />
      Approved
    </Badge>
  ) : doc.status === "REVIEWED" ? (
    <Badge
      variant="outline"
      className="gap-1 border-blue-200 bg-blue-50 text-blue-700 text-[11px]"
    >
      <FileSearch className="h-3 w-3" />
      Reviewed
    </Badge>
  ) : (
    <Badge
      variant="outline"
      className="gap-1 border-amber-200 bg-amber-50 text-amber-700 text-[11px]"
    >
      <Clock className="h-3 w-3" />
      Pending
    </Badge>
  );

  return (
    <Card className="group transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          {/* Score */}
          <ScoreCircle score={review.aiSummary?.overallScore ?? null} />

          {/* Main content */}
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <DocTypeBadge type={doc.type} />
              {statusBadge}

              {/* Feedback indicator */}
              {review.feedback && !review.isApproved && (
                <Badge
                  variant="outline"
                  className="border-gray-200 bg-gray-50 text-gray-500 text-[10px]"
                >
                  Feedback added
                </Badge>
              )}
            </div>

            <p className="font-semibold text-gray-900 leading-tight line-clamp-1">
              {doc.name}
            </p>

            <p className="text-xs text-gray-500">
              <Link
                href={`/projects/${doc.project.id}`}
                className="text-indigo-600 hover:underline font-medium"
                onClick={(e) => e.stopPropagation()}
              >
                {doc.project.name}
              </Link>
              {" · "}
              Reviewed {timeAgo(review.createdAt)}
            </p>
          </div>

          {/* View button */}
          <Button
            render={<Link href={`/reviews/${review.id}`} />}
            variant="ghost"
            size="sm"
            className="shrink-0 hidden sm:flex h-8 gap-1.5 text-xs text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
          >
            <Eye className="h-3.5 w-3.5" />
            View
          </Button>
        </div>
      </CardHeader>

      {/* AI summary + flagged issues row */}
      {review.aiSummary && (
        <CardContent className="pt-0">
          <div className="rounded-lg bg-gray-50 px-3 py-2.5 space-y-1.5">
            {review.aiSummary.summary && (
              <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                {review.aiSummary.summary}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
              {review.aiSummary.flaggedCount > 0 && (
                <span className="flex items-center gap-1 text-red-600">
                  <AlertCircle className="h-3 w-3" />
                  {review.aiSummary.flaggedCount} flagged{" "}
                  {review.aiSummary.flaggedCount === 1 ? "issue" : "issues"}
                </span>
              )}
              {review.aiSummary.missingSectionCount > 0 && (
                <span className="flex items-center gap-1 text-amber-600">
                  <FileText className="h-3 w-3" />
                  {review.aiSummary.missingSectionCount} missing{" "}
                  {review.aiSummary.missingSectionCount === 1
                    ? "section"
                    : "sections"}
                </span>
              )}
              {review.aiSummary.flaggedCount === 0 &&
                review.aiSummary.missingSectionCount === 0 && (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="h-3 w-3" />
                    No issues flagged
                  </span>
                )}

              <span className="ml-auto text-gray-400">
                {formatDate(review.createdAt)}
              </span>
            </div>
          </div>

          {/* Mobile view button */}
          <div className="mt-3 sm:hidden">
            <Button
              render={<Link href={`/reviews/${review.id}`} />}
              variant="outline"
              size="sm"
              className="w-full gap-1.5 text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50"
            >
              <Eye className="h-3.5 w-3.5" />
              View full review
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────
// Skeleton loader
// ─────────────────────────────────────────────
function ReviewCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex gap-2">
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-14 rounded-md shrink-0 hidden sm:block" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Skeleton className="h-16 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────
function EmptyState({ statusFilter }: { statusFilter: StatusFilter }) {
  const messages: Record<StatusFilter, { title: string; desc: string }> = {
    ALL: {
      title: "No reviews yet",
      desc: "Generate an AI review from a project's document to see it here.",
    },
    PENDING: {
      title: "No pending reviews",
      desc: "All documents have been reviewed or approved.",
    },
    REVIEWED: {
      title: "No reviewed documents",
      desc: "Reviewed documents waiting for approval will appear here.",
    },
    APPROVED: {
      title: "No approved documents",
      desc: "Documents you've approved will appear here.",
    },
  };

  const { title, desc } = messages[statusFilter];

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-white py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50">
        <FileSearch className="h-7 w-7 text-indigo-400" />
      </div>
      <h3 className="mb-1 text-base font-semibold text-gray-900">{title}</h3>
      <p className="max-w-xs text-sm text-gray-500">{desc}</p>
      {statusFilter === "ALL" && (
        <Button
          render={<Link href="/projects" />}
          variant="outline"
          size="sm"
          className="mt-5 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
        >
          Go to Projects
        </Button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Inner component (uses useSearchParams)
// ─────────────────────────────────────────────
function ReviewsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialStatus = (searchParams.get("status") as StatusFilter) ?? "ALL";

  const [reviews, setReviews] = useState<ReviewListItem[]>([]);
  const [meta, setMeta] = useState({
    total: 0,
    totalPending: 0,
    totalReviewed: 0,
    totalApproved: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const loadReviews = useCallback(
    async (refresh = false) => {
      if (refresh) setIsRefreshing(true);
      else setIsLoading(true);

      try {
        const params = new URLSearchParams();
        if (statusFilter !== "ALL") params.set("status", statusFilter);
        if (typeFilter !== "ALL") params.set("type", typeFilter);

        const url = `/api/reviews${params.toString() ? `?${params}` : ""}`;
        const res = await fetch(url);
        const data: ReviewsResponse = await res.json();

        if (!res.ok) {
          toast.error("Failed to load reviews.");
          return;
        }

        setReviews(data.data);
        setMeta(data.meta);
      } catch {
        toast.error("An unexpected error occurred.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [statusFilter, typeFilter],
  );

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  // Sync status filter → URL
  function handleStatusChange(value: StatusFilter) {
    setStatusFilter(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value === "ALL") {
      params.delete("status");
    } else {
      params.set("status", value);
    }
    router.replace(`/reviews?${params.toString()}`, { scroll: false });
  }

  // ── Client-side search filter ──────────────────────────────────────
  const filtered = reviews.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.document.name.toLowerCase().includes(q) ||
      r.document.project.name.toLowerCase().includes(q)
    );
  });

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto w-full space-y-6">
      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Reviews
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            AI-generated reports on student SRS and OPPM documents.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => loadReviews(true)}
          disabled={isRefreshing || isLoading}
          className="shrink-0 gap-1.5"
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")}
          />
          Refresh
        </Button>
      </div>

      {/* ── Status tabs ──────────────────────────────────────────────── */}
      <Tabs
        value={statusFilter}
        onValueChange={(v) => handleStatusChange(v as StatusFilter)}
      >
        <TabsList className="h-9 w-full sm:w-auto">
          <TabsTrigger
            value="ALL"
            className="text-xs gap-1.5 flex-1 sm:flex-none"
          >
            All
            {!isLoading && (
              <span className="ml-0.5 rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">
                {meta.total}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="PENDING"
            className="text-xs gap-1.5 flex-1 sm:flex-none"
          >
            <Clock className="h-3 w-3" />
            Pending
            {!isLoading && meta.totalPending > 0 && (
              <span className="ml-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                {meta.totalPending}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="REVIEWED"
            className="text-xs gap-1.5 flex-1 sm:flex-none"
          >
            <FileSearch className="h-3 w-3" />
            Reviewed
            {!isLoading && meta.totalReviewed > 0 && (
              <span className="ml-0.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                {meta.totalReviewed}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="APPROVED"
            className="text-xs gap-1.5 flex-1 sm:flex-none"
          >
            <CheckCircle2 className="h-3 w-3" />
            Approved
            {!isLoading && meta.totalApproved > 0 && (
              <span className="ml-0.5 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
                {meta.totalApproved}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* ── Search + type filter ─────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by document or project name…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 shrink-0 text-gray-400" />
          <Select
            value={typeFilter}
            onValueChange={(v) => setTypeFilter(v as TypeFilter)}
          >
            <SelectTrigger className="h-9 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All types</SelectItem>
              <SelectItem value="SRS">SRS only</SelectItem>
              <SelectItem value="OPPM">OPPM only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Results count ────────────────────────────────────────────── */}
      {!isLoading && reviews.length > 0 && (
        <p className="text-sm text-gray-500">
          Showing{" "}
          <span className="font-medium text-gray-700">{filtered.length}</span>{" "}
          {filtered.length !== reviews.length && (
            <>
              of{" "}
              <span className="font-medium text-gray-700">
                {reviews.length}
              </span>{" "}
            </>
          )}
          review{filtered.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* ── Content ──────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <ReviewCardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        searchQuery ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
            <Search className="mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm font-medium text-gray-600">
              No results found
            </p>
            <p className="mt-1 text-xs text-gray-400">
              No reviews match &quot;{searchQuery}&quot;.
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 text-indigo-600"
              onClick={() => setSearchQuery("")}
            >
              Clear search
            </Button>
          </div>
        ) : (
          <EmptyState statusFilter={statusFilter} />
        )
      ) : (
        <div className="space-y-3">
          {filtered.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Page export (wrapped in Suspense for
// useSearchParams to work in App Router)
// ─────────────────────────────────────────────
export default function ReviewsPage() {
  return (
    <Suspense
      fallback={
        <div className="px-6 py-8 max-w-5xl mx-auto w-full space-y-6">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-9 w-80 rounded-md" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <ReviewCardSkeleton key={i} />
            ))}
          </div>
        </div>
      }
    >
      <ReviewsPageInner />
    </Suspense>
  );
}
