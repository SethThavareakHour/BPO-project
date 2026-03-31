"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  FileSearch,
  AlertCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
  Pencil,
  ThumbsUp,
  ExternalLink,
  RotateCcw,
  FileText,
  Users,
  RefreshCw,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  cn,
  formatDate,
  formatDateTime,
  scoreToColor,
  statusToColor,
  severityToColor,
  fetcher,
} from "@/lib/utils"
import type { AIReport, FlaggedIssue, ReviewCategory, ApiSuccess } from "@/types"

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface ReviewDetail {
  id: string
  documentId: string
  aiReport: AIReport
  feedback: string | null
  feedbackType: "AI_GENERATED" | "MANUAL" | null
  isApproved: boolean
  approvedAt: string | null
  createdAt: string
  updatedAt: string
  document: {
    id: string
    name: string
    type: "SRS" | "OPPM" | "UNKNOWN"
    driveFileId: string
    mimeType: string | null
    driveUrl: string | null
    status: "PENDING" | "REVIEWING" | "REVIEWED" | "APPROVED"
    projectId: string
    createdAt: string
    updatedAt: string
    project: {
      id: string
      name: string
      advisorId: string
      students: {
        id: string
        name: string
        email: string
        studentId: string | null
      }[]
    }
  }
}

// ─────────────────────────────────────────────
// Score circle
// ─────────────────────────────────────────────
function ScoreCircle({
  score,
  size = "lg",
}: {
  score: number
  size?: "sm" | "lg"
}) {
  const sizeClasses =
    size === "lg"
      ? "h-20 w-20 text-2xl border-4"
      : "h-12 w-12 text-sm border-2"

  const colorClass =
    score >= 75
      ? "border-green-400 bg-green-50 text-green-700"
      : score >= 40
      ? "border-amber-400 bg-amber-50 text-amber-700"
      : "border-red-400 bg-red-50 text-red-700"

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-bold",
        sizeClasses,
        colorClass
      )}
      title={`Score: ${score}/100`}
    >
      {score}
    </div>
  )
}

// ─────────────────────────────────────────────
// Category card (Completeness / Clarity / Feasibility)
// ─────────────────────────────────────────────
function CategoryCard({
  title,
  category,
}: {
  title: string
  category: ReviewCategory
}) {
  const [expanded, setExpanded] = useState(false)
  const hasDetails =
    category.issues.length > 0 || category.suggestions.length > 0

  return (
    <Card className="overflow-hidden">
      <CardHeader
        className={cn(
          "pb-3 cursor-pointer select-none",
          hasDetails && "hover:bg-gray-50 transition-colors"
        )}
        onClick={() => hasDetails && setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-4">
          {/* Score circle */}
          <ScoreCircle score={category.score} size="sm" />

          {/* Title + status */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-sm font-semibold text-gray-900">
                {title}
              </CardTitle>
              <Badge
                variant="outline"
                className={cn("text-[10px] px-1.5", statusToColor(category.status))}
              >
                {category.status}
              </Badge>
            </div>
            <CardDescription className="mt-0.5 text-xs leading-relaxed line-clamp-2">
              {category.summary}
            </CardDescription>
          </div>

          {/* Expand toggle */}
          {hasDetails && (
            <button
              className="shrink-0 text-gray-400 hover:text-gray-600 focus:outline-none"
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </CardHeader>

      {/* Expanded details */}
      {expanded && hasDetails && (
        <CardContent className="pt-0 pb-4 space-y-3">
          <Separator />

          {category.issues.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-600">
                Issues ({category.issues.length})
              </p>
              <ul className="space-y-1">
                {category.issues.map((issue, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-xs text-gray-700"
                  >
                    <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {category.suggestions.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                Suggestions ({category.suggestions.length})
              </p>
              <ul className="space-y-1">
                {category.suggestions.map((s, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-xs text-gray-700"
                  >
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

// ─────────────────────────────────────────────
// Flagged issue card
// ─────────────────────────────────────────────
function FlaggedIssueCard({ issue }: { issue: FlaggedIssue }) {
  const severityIcon =
    issue.severity === "HIGH" ? (
      <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
    ) : issue.severity === "MEDIUM" ? (
      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
    ) : (
      <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
    )

  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3 space-y-1.5",
        issue.severity === "HIGH"
          ? "border-red-200 bg-red-50"
          : issue.severity === "MEDIUM"
          ? "border-amber-200 bg-amber-50"
          : "border-blue-200 bg-blue-50"
      )}
    >
      <div className="flex items-start gap-2">
        {severityIcon}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn("text-[10px] px-1.5", severityToColor(issue.severity))}
            >
              {issue.severity}
            </Badge>
            <span className="text-xs font-semibold text-gray-700">
              {issue.section}
            </span>
          </div>
          <p className="text-sm text-gray-800">{issue.issue}</p>
          <p className="text-xs text-gray-600">
            <span className="font-medium">Suggestion: </span>
            {issue.suggestion}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Feedback section
// ─────────────────────────────────────────────
function FeedbackSection({
  review,
  onFeedbackSaved,
}: {
  review: ReviewDetail
  onFeedbackSaved: (feedback: string, type: "AI_GENERATED" | "MANUAL") => void
}) {
  const [mode, setMode] = useState<"view" | "manual" | "ai">("view")
  const [manualText, setManualText] = useState(review.feedback ?? "")
  const [isLoading, setIsLoading] = useState(false)

  // Sync when feedback changes externally
  useEffect(() => {
    setManualText(review.feedback ?? "")
  }, [review.feedback])

  async function handleGenerateAI() {
    setIsLoading(true)
    setMode("ai")

    try {
      const res = await fetch(`/api/reviews/${review.id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedbackType: "AI_GENERATED" }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? "Failed to generate AI feedback.")
        setMode("view")
        return
      }

      toast.success("AI feedback generated successfully.")
      onFeedbackSaved(data.data.feedback, "AI_GENERATED")
      setMode("view")
    } catch {
      toast.error("An unexpected error occurred.")
      setMode("view")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSaveManual() {
    if (!manualText.trim() || manualText.trim().length < 10) {
      toast.error("Feedback must be at least 10 characters.")
      return
    }

    setIsLoading(true)

    try {
      const res = await fetch(`/api/reviews/${review.id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedbackType: "MANUAL",
          feedback: manualText.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? "Failed to save feedback.")
        return
      }

      toast.success("Feedback saved successfully.")
      onFeedbackSaved(manualText.trim(), "MANUAL")
      setMode("view")
    } catch {
      toast.error("An unexpected error occurred.")
    } finally {
      setIsLoading(false)
    }
  }

  // ── View mode (feedback already exists) ──────────────────────────
  if (mode === "view" && review.feedback) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold text-gray-900">
                Feedback
              </CardTitle>
              {review.feedbackType && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px]",
                    review.feedbackType === "AI_GENERATED"
                      ? "border-violet-200 bg-violet-50 text-violet-700"
                      : "border-blue-200 bg-blue-50 text-blue-700"
                  )}
                >
                  {review.feedbackType === "AI_GENERATED"
                    ? "AI Generated"
                    : "Manual"}
                </Badge>
              )}
            </div>

            {!review.isApproved && (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1 text-gray-500 hover:text-gray-700"
                  onClick={() => {
                    setManualText(review.feedback ?? "")
                    setMode("manual")
                  }}
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1 text-violet-600 hover:text-violet-700 hover:bg-violet-50"
                  onClick={handleGenerateAI}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  Re-generate
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-sm leading-relaxed text-gray-800 whitespace-pre-wrap">
              {review.feedback}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ── Manual edit mode ──────────────────────────────────────────────
  if (mode === "manual") {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-900">
            Write feedback
          </CardTitle>
          <CardDescription className="text-xs">
            Write constructive feedback for the student. This will be sent to
            them via email when you approve the document.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder="Write your feedback here. Be specific and constructive…"
            rows={8}
            className="resize-none text-sm leading-relaxed"
            disabled={isLoading}
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-gray-400">
              {manualText.trim().length} characters
              {manualText.trim().length < 10 && (
                <span className="text-red-500"> (minimum 10)</span>
              )}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setManualText(review.feedback ?? "")
                  setMode("view")
                }}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveManual}
                disabled={isLoading || manualText.trim().length < 10}
                className="bg-gray-900 hover:bg-gray-800 text-white gap-1.5 rounded-xl"
              >
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                Save feedback
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ── No feedback yet — choose mode ─────────────────────────────────
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-gray-900">
          Add feedback
        </CardTitle>
        <CardDescription className="text-xs">
          Provide feedback to the student before approving. Choose to generate
          it with AI based on the report, or write it yourself.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* AI feedback */}
          <button
            className={cn(
              "group flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all",
              "border-violet-200 bg-violet-50 hover:border-violet-400 hover:bg-violet-100",
              isLoading && mode === "ai" && "opacity-70 cursor-not-allowed"
            )}
            onClick={handleGenerateAI}
            disabled={isLoading}
          >
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-white">
                {isLoading && mode === "ai" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
              </div>
              <span className="text-sm font-semibold text-violet-900">
                Generate with AI
              </span>
            </div>
            <p className="text-xs text-violet-700 leading-relaxed">
              The AI will write a professional, constructive feedback message
              based on the review report.
            </p>
          </button>

          {/* Manual feedback */}
          <button
            className="group flex flex-col items-start gap-2 rounded-xl border-2 border-blue-200 bg-blue-50 p-4 text-left transition-all hover:border-blue-400 hover:bg-blue-100"
            onClick={() => setMode("manual")}
            disabled={isLoading}
          >
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                <Pencil className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold text-blue-900">
                Write manually
              </span>
            </div>
            <p className="text-xs text-blue-700 leading-relaxed">
              Write your own personalised feedback message for the student in
              your own words.
            </p>
          </button>
        </div>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────
// Approve / Revoke dialog
// ─────────────────────────────────────────────
function ApproveDialog({
  open,
  onOpenChange,
  review,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  review: ReviewDetail
  onSuccess: () => void
}) {
  const [isLoading, setIsLoading] = useState(false)

  async function handleApprove() {
    setIsLoading(true)

    try {
      const res = await fetch(`/api/reviews/${review.id}/approve`, {
        method: "POST",
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? "Failed to approve document.")
        return
      }

      toast.success(data.message ?? "Document approved!")
      onOpenChange(false)
      onSuccess()
    } catch {
      toast.error("An unexpected error occurred.")
    } finally {
      setIsLoading(false)
    }
  }

  const students = review.document.project.students

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-gray-900">
            Approve document
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            You are about to approve{" "}
            <span className="font-semibold text-gray-800">
              &quot;{review.document.name}&quot;
            </span>{" "}
            for project{" "}
            <span className="font-semibold text-gray-800">
              {review.document.project.name}
            </span>
            .
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Feedback preview */}
          {review.feedback && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-green-700">
                Feedback that will be sent
              </p>
              <p className="line-clamp-4 text-xs text-green-800 leading-relaxed">
                {review.feedback}
              </p>
            </div>
          )}

          {/* Student notification list */}
          {students.length > 0 ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600">
                <Users className="h-3.5 w-3.5" />
                Students to be notified ({students.length})
              </p>
              <ul className="space-y-1">
                {students.map((s) => (
                  <li key={s.id} className="text-xs text-gray-700">
                    <span className="font-medium">{s.name}</span>{" "}
                    <span className="text-gray-400">— {s.email}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-xs text-amber-800">
                No students are registered in this project. The approval will
                proceed, but no email notifications will be sent.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleApprove}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700 text-white min-w-[120px] gap-1.5"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ThumbsUp className="h-4 w-4" />
            )}
            {isLoading ? "Approving…" : "Approve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────
// Loading skeleton
// ─────────────────────────────────────────────
function ReviewDetailSkeleton() {
  return (
    <div className="px-8 py-8 max-w-4xl mx-auto w-full space-y-6 animate-fade-in-up">
      <Skeleton className="h-4 w-36" />
      <div className="flex items-start gap-5">
        <Skeleton className="h-20 w-20 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-36 rounded-xl" />
    </div>
  )
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function ReviewDetailPage() {
  const params = useParams()
  const router = useRouter()
  const reviewId = params.id as string

  const [review, setReview] = useState<ReviewDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [approveOpen, setApproveOpen] = useState(false)
  const [isRevoking, setIsRevoking] = useState(false)

  const loadReview = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetcher<ApiSuccess<ReviewDetail>>(
        `/api/reviews/${reviewId}`
      )
      setReview(res.data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load review."
      if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
        toast.error("Review not found.")
        router.push("/reviews")
      } else {
        toast.error(msg)
      }
    } finally {
      setIsLoading(false)
    }
  }, [reviewId, router])

  useEffect(() => {
    loadReview()
  }, [loadReview])

  function handleFeedbackSaved(
    feedback: string,
    type: "AI_GENERATED" | "MANUAL"
  ) {
    setReview((prev) =>
      prev ? { ...prev, feedback, feedbackType: type } : prev
    )
  }

  async function handleRevokeApproval() {
    if (
      !confirm(
        "Revoke approval? The document will return to Reviewed status and students will not be notified."
      )
    )
      return

    setIsRevoking(true)

    try {
      const res = await fetch(`/api/reviews/${reviewId}/approve`, {
        method: "DELETE",
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? "Failed to revoke approval.")
        return
      }

      toast.success(data.message ?? "Approval revoked.")
      loadReview()
    } catch {
      toast.error("An unexpected error occurred.")
    } finally {
      setIsRevoking(false)
    }
  }

  // ── Loading ──────────────────────────────────────────────────────
  if (isLoading) return <ReviewDetailSkeleton />
  if (!review) return null

  const report = review.aiReport
  const doc = review.document
  const highIssues = report.flaggedIssues.filter((i) => i.severity === "HIGH")
  const mediumIssues = report.flaggedIssues.filter(
    (i) => i.severity === "MEDIUM"
  )
  const lowIssues = report.flaggedIssues.filter((i) => i.severity === "LOW")

  const canApprove =
    !review.isApproved && !!review.feedback && review.feedback.trim().length > 0

  return (
    <div className="px-8 py-8 max-w-4xl mx-auto w-full space-y-6 animate-fade-in-up">
      {/* ── Breadcrumb ──────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link
          href="/reviews"
          className="inline-flex items-center gap-1.5 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Reviews
        </Link>
        <span className="text-gray-300">/</span>
        <span className="truncate max-w-[200px] text-gray-700 font-medium">
          {doc.name}
        </span>
      </div>

      {/* ── Header: score + document info ───────────────────────── */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        {/* Large score circle */}
        <ScoreCircle score={report.overallScore} size="lg" />

        {/* Document info */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* Doc type */}
            <span
              className={cn(
                "inline-flex items-center rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wide",
                doc.type === "SRS"
                  ? "bg-indigo-100 text-indigo-700"
                  : doc.type === "OPPM"
                  ? "bg-violet-100 text-violet-700"
                  : "bg-gray-100 text-gray-500"
              )}
            >
              {doc.type}
            </span>

            {/* Approval status */}
            {review.isApproved ? (
              <Badge
                variant="outline"
                className="gap-1 border-green-200 bg-green-50 text-green-700 text-xs"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approved
                {review.approvedAt && (
                  <span className="text-green-500">
                    · <span suppressHydrationWarning>{formatDate(review.approvedAt)}</span>
                  </span>
                )}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="gap-1 border-blue-200 bg-blue-50 text-blue-700 text-xs"
              >
                <FileSearch className="h-3.5 w-3.5" />
                Reviewed
              </Badge>
            )}

            {/* Score label */}
            <span className={cn("text-xs font-semibold", scoreToColor(report.overallScore))}>
              {report.overallScore >= 75
                ? "Good"
                : report.overallScore >= 40
                ? "Needs work"
                : "Significant issues"}
            </span>
          </div>

          <h1 className="text-xl font-bold tracking-tight text-gray-900 break-words">
            {doc.name}
          </h1>

          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
            <Link
              href={`/projects/${doc.project.id}`}
              className="inline-flex items-center gap-1 text-indigo-600 hover:underline font-medium"
            >
              <FileText className="h-3.5 w-3.5" />
              {doc.project.name}
            </Link>

            {doc.driveUrl && (
              <a
                href={doc.driveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-gray-500 hover:text-indigo-600 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open in Drive
              </a>
            )}

            <span className="text-gray-400">
              Reviewed <span suppressHydrationWarning>{formatDateTime(review.createdAt)}</span>
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadReview()}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>

          {review.isApproved ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRevokeApproval}
              disabled={isRevoking}
              className="gap-1.5 text-xs text-red-600 border-red-200 hover:bg-red-50"
            >
              {isRevoking ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" />
              )}
              Revoke approval
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => setApproveOpen(true)}
              disabled={!canApprove}
              title={
                !review.feedback
                  ? "Add feedback before approving"
                  : "Approve this document"
              }
              className={cn(
                "gap-1.5 text-xs text-white",
                canApprove
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-gray-300 cursor-not-allowed"
              )}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
              Approve document
            </Button>
          )}
        </div>
      </div>

      {!canApprove && !review.isApproved && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-xs text-amber-800">
            <span className="font-semibold">Feedback required: </span>
            You must add feedback (AI-generated or manual) before you can
            approve this document.
          </p>
        </div>
      )}

      <Separator />

      {/* ── AI report summary ────────────────────────────────────── */}
      <div className="space-y-2">
        <h2 className="text-base font-semibold text-gray-900">
          AI Review Summary
        </h2>
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-5 py-4">
          <p className="text-sm text-indigo-900 leading-relaxed">
            {report.summary}
          </p>
          <p className="mt-2 text-xs text-indigo-500">
            Generated at <span suppressHydrationWarning>{formatDateTime(report.generatedAt)}</span>
          </p>
        </div>
      </div>

      {/* ── Category scores ──────────────────────────────────────── */}
      <div className="space-y-2">
        <h2 className="text-base font-semibold text-gray-900">
          Category Scores
        </h2>
        <p className="text-xs text-gray-500">
          Click a card to expand issues and suggestions for that category.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <CategoryCard title="Completeness" category={report.completeness} />
          <CategoryCard title="Clarity" category={report.clarity} />
          <CategoryCard title="Feasibility" category={report.feasibility} />
        </div>
      </div>

      {/* ── Missing sections ─────────────────────────────────────── */}
      {report.missingSections.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            Missing Sections
            <Badge
              variant="outline"
              className="border-amber-200 bg-amber-50 text-amber-700 text-[10px]"
            >
              {report.missingSections.length}
            </Badge>
          </h2>
          <div className="flex flex-wrap gap-2">
            {report.missingSections.map((section, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800"
              >
                <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                {section}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Flagged issues ───────────────────────────────────────── */}
      {report.flaggedIssues.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              Flagged Issues
              <Badge
                variant="outline"
                className="border-red-200 bg-red-50 text-red-700 text-[10px]"
              >
                {report.flaggedIssues.length}
              </Badge>
            </h2>
            {/* Severity summary chips */}
            <div className="flex items-center gap-2 text-[11px]">
              {highIssues.length > 0 && (
                <span className="flex items-center gap-1 font-medium text-red-600">
                  <AlertCircle className="h-3 w-3" />
                  {highIssues.length} High
                </span>
              )}
              {mediumIssues.length > 0 && (
                <span className="flex items-center gap-1 font-medium text-amber-600">
                  <AlertTriangle className="h-3 w-3" />
                  {mediumIssues.length} Med
                </span>
              )}
              {lowIssues.length > 0 && (
                <span className="flex items-center gap-1 font-medium text-blue-600">
                  <Info className="h-3 w-3" />
                  {lowIssues.length} Low
                </span>
              )}
            </div>
          </div>

          {/* High severity first */}
          <div className="space-y-2">
            {[...highIssues, ...mediumIssues, ...lowIssues].map((issue, i) => (
              <FlaggedIssueCard key={i} issue={issue} />
            ))}
          </div>
        </div>
      )}

      {report.flaggedIssues.length === 0 && report.missingSections.length === 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-5 py-4">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-green-600" />
          <div>
            <p className="text-sm font-semibold text-green-800">
              No issues flagged
            </p>
            <p className="text-xs text-green-700">
              The AI did not identify any significant issues or missing sections
              in this document.
            </p>
          </div>
        </div>
      )}

      <Separator />

      {/* ── Feedback section ─────────────────────────────────────── */}
      {!review.isApproved ? (
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">
            Advisor Feedback
          </h2>
          <FeedbackSection
            review={review}
            onFeedbackSaved={handleFeedbackSaved}
          />
        </div>
      ) : (
        review.feedback && (
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              Advisor Feedback Sent
              {review.feedbackType && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px]",
                    review.feedbackType === "AI_GENERATED"
                      ? "border-violet-200 bg-violet-50 text-violet-700"
                      : "border-blue-200 bg-blue-50 text-blue-700"
                  )}
                >
                  {review.feedbackType === "AI_GENERATED"
                    ? "AI Generated"
                    : "Manual"}
                </Badge>
              )}
            </h2>
            <div className="rounded-lg border border-green-200 bg-green-50 px-5 py-4">
              <p className="text-sm leading-relaxed text-gray-800 whitespace-pre-wrap">
                {review.feedback}
              </p>
            </div>
          </div>
        )
      )}

      {/* ── Approve dialog ──────────────────────────────────────── */}
      {approveOpen && (
        <ApproveDialog
          open={approveOpen}
          onOpenChange={setApproveOpen}
          review={review}
          onSuccess={loadReview}
        />
      )}
    </div>
  )
}
