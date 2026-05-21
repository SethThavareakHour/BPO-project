import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { generateReviewFromExtraction } from "@/lib/review-service"

// ─────────────────────────────────────────────
// POST /api/reviews/[id]/generate
// [id] here is the Document ID (not a Review ID),
// because the review may not exist yet.
//
// Flow:
//   1. Verify advisor owns the document's project
//   2. Load stored document extraction text
//   3. Call the AI review engine
//   4. Upsert the Review record
//   5. Update document status -> REVIEWED
// ─────────────────────────────────────────────
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorised." }, { status: 401 })
    }

    const { id: documentId } = await params

    // ── 1. Load document with project + existing review ───────────────
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            advisorId: true,
          },
        },
        review: {
          select: { id: true },
        },
        extraction: {
          select: {
            text: true,
            status: true,
          },
        },
      },
    })

    if (!document) {
      return NextResponse.json(
        { error: "Document not found." },
        { status: 404 }
      )
    }

    // ── 2. Ownership guard ────────────────────────────────────────────
    if (document.project.advisorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }

    const result = await generateReviewFromExtraction({
      id: document.id,
      name: document.name,
      type: document.type,
      status: document.status,
      extraction: document.extraction,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const { review } = result
    return NextResponse.json(
      {
        data: {
          reviewId:   review.id,
          documentId: review.documentId,
          aiReport:   review.aiReport,
          isApproved: review.isApproved,
          createdAt:  review.createdAt,
          updatedAt:  review.updatedAt,
        },
        message: "AI review generated successfully.",
      },
      { status: 201 }
    )
  } catch (err) {
    console.error("[reviews/[id]/generate] Unexpected error:", err)
    return NextResponse.json(
      { error: "An unexpected error occurred while generating the review." },
      { status: 500 }
    )
  }
}
