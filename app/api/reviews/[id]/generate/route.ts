import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { extractTextFromFile } from "@/lib/drive"
import { reviewDocument } from "@/lib/ai"

// ─────────────────────────────────────────────
// POST /api/reviews/[id]/generate
// [id] here is the Document ID (not a Review ID),
// because the review may not exist yet.
//
// Flow:
//   1. Verify advisor owns the document's project
//   2. Download + extract text from the Drive file
//   3. Call the AI review engine
//   4. Upsert the Review record
//   5. Update document status → REVIEWED
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

    // ── 3. Guard against unsupported document types ───────────────────
    if (document.type === "UNKNOWN") {
      return NextResponse.json(
        {
          error:
            "Cannot review this document because its type could not be determined. " +
            "Rename the file to include 'SRS' or 'OPPM' in the filename and re-scan.",
        },
        { status: 400 }
      )
    }

    // ── 4. Guard: do not re-review an already approved document ───────
    if (document.status === "APPROVED") {
      return NextResponse.json(
        {
          error:
            "This document has already been approved and cannot be re-reviewed.",
        },
        { status: 409 }
      )
    }

    // ── 5. Mark document as REVIEWING ─────────────────────────────────
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "REVIEWING" },
    })

    // ── 6. Extract text from the Drive file ───────────────────────────
    let documentText: string

    try {
      documentText = await extractTextFromFile(
        document.driveFileId,
        document.mimeType ?? "application/pdf"
      )
    } catch (driveError) {
      // Revert status on failure
      await prisma.document.update({
        where: { id: documentId },
        data: { status: "PENDING" },
      })

      const message =
        driveError instanceof Error ? driveError.message : String(driveError)

      return NextResponse.json(
        {
          error: `Failed to read the file from Google Drive: ${message}`,
        },
        { status: 502 }
      )
    }

    if (!documentText || documentText.trim().length < 50) {
      // Revert status
      await prisma.document.update({
        where: { id: documentId },
        data: { status: "PENDING" },
      })

      return NextResponse.json(
        {
          error:
            "The document appears to be empty or contains too little text to review. " +
            "Please ensure the file has readable content (not a scanned image).",
        },
        { status: 422 }
      )
    }

    // ── 7. Run AI review ──────────────────────────────────────────────
    let aiReport

    try {
      aiReport = await reviewDocument(documentText, document.type as "SRS" | "OPPM")
    } catch (aiError) {
      // Revert status on failure
      await prisma.document.update({
        where: { id: documentId },
        data: { status: "PENDING" },
      })

      const message =
        aiError instanceof Error ? aiError.message : String(aiError)

      return NextResponse.json(
        {
          error: `AI review failed: ${message}`,
        },
        { status: 502 }
      )
    }

    // ── 8. Upsert the Review record ───────────────────────────────────
    // Use upsert so that re-generating a review replaces the old one
    // but resets approval / feedback (since the content changed).
    const review = await prisma.review.upsert({
      where: { documentId },
      create: {
        documentId,
        aiReport: aiReport as object,
        feedback: null,
        feedbackType: null,
        isApproved: false,
        approvedAt: null,
      },
      update: {
        aiReport: aiReport as object,
        // Reset feedback and approval when the review is regenerated
        feedback: null,
        feedbackType: null,
        isApproved: false,
        approvedAt: null,
        updatedAt: new Date(),
      },
    })

    // ── 9. Update document status → REVIEWED ─────────────────────────
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "REVIEWED" },
    })

    // ── 10. Return the review ─────────────────────────────────────────
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
