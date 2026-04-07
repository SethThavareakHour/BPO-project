import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

// ─────────────────────────────────────────────
// GET /api/reviews
// Returns all reviews for the logged-in advisor's projects
// Query params:
//   - status: "PENDING" | "REVIEWED" | "APPROVED"  (maps to document status)
//   - type:   "SRS" | "OPPM"
//   - projectId: string
// ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorised." }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const statusFilter  = searchParams.get("status")   // document status
    const typeFilter    = searchParams.get("type")      // SRS | OPPM
    const projectFilter = searchParams.get("projectId")

    // Build dynamic where clause
    const where: Record<string, unknown> = {
      document: {
        project: {
          advisorId: session.user.id,
        },
        // Only apply type filter if provided and valid
        ...(typeFilter === "SRS" || typeFilter === "OPPM"
          ? { type: typeFilter }
          : {}),
        // Map status filter to document status
        ...(statusFilter === "PENDING"
          ? { status: { in: ["PENDING", "REVIEWING"] } }
          : statusFilter === "REVIEWED"
          ? { status: "REVIEWED" }
          : statusFilter === "APPROVED"
          ? { status: "APPROVED" }
          : {}),
        // Filter by project if provided
        ...(projectFilter ? { projectId: projectFilter } : {}),
      },
    }

    const reviews = await prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        document: {
          select: {
            id: true,
            name: true,
            type: true,
            driveFileId: true,
            mimeType: true,
            driveUrl: true,
            status: true,
            projectId: true,
            createdAt: true,
            updatedAt: true,
            project: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })

    // Shape the response — omit the heavy aiReport JSON from the list view
    // to keep payloads small. Full report is fetched on the detail route.
    const shaped = reviews.map((r) => {
      const report = r.aiReport as Record<string, unknown> | null

      return {
        id: r.id,
        documentId: r.documentId,
        document: r.document,
        // Only include the summary fields from the AI report, not the full object
        aiSummary: report
          ? {
              overallScore:  report.overallScore  ?? null,
              documentType:  report.documentType  ?? null,
              summary:       report.summary       ?? null,
              flaggedCount:  Array.isArray(report.flaggedIssues)
                ? (report.flaggedIssues as unknown[]).length
                : 0,
              missingSectionCount: Array.isArray(report.missingSections)
                ? (report.missingSections as unknown[]).length
                : 0,
            }
          : null,
        feedback:     r.feedback,
        feedbackType: r.feedbackType,
        isApproved:   r.isApproved,
        approvedAt:   r.approvedAt,
        createdAt:    r.createdAt,
        updatedAt:    r.updatedAt,
      }
    })

    // Aggregate counts for the filter badges in the UI
    const [totalPending, totalReviewed, totalApproved] = await Promise.all([
      prisma.review.count({
        where: {
          document: {
            project: { advisorId: session.user.id },
            status: { in: ["PENDING", "REVIEWING"] },
          },
        },
      }),
      prisma.review.count({
        where: {
          document: {
            project: { advisorId: session.user.id },
            status: "REVIEWED",
          },
        },
      }),
      prisma.review.count({
        where: {
          document: {
            project: { advisorId: session.user.id },
            status: "APPROVED",
          },
        },
      }),
    ])

    return NextResponse.json({
      data: shaped,
      meta: {
        total:         shaped.length,
        totalPending,
        totalReviewed,
        totalApproved,
      },
    })
  } catch (err) {
    console.error("[reviews:GET] Unexpected error:", err)
    return NextResponse.json(
      { error: "Failed to fetch reviews." },
      { status: 500 }
    )
  }
}
