import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { sendApprovalNotificationEmail } from "@/lib/mailer"

// ─────────────────────────────────────────────
// POST /api/reviews/[id]/approve
// [id] is the Review ID.
//
// Flow:
//   1. Verify advisor owns the review's project
//   2. Verify feedback exists before approving
//   3. Mark review as approved
//   4. Update document status → APPROVED
//   5. Email all students in the project
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

    const { id: reviewId } = await params

    // ── 1. Load the review with full context ──────────────────────────
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        document: {
          include: {
            project: {
              include: {
                students: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!review) {
      return NextResponse.json(
        { error: "Review not found." },
        { status: 404 }
      )
    }

    // ── 2. Ownership guard ────────────────────────────────────────────
    if (review.document.project.advisorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }

    // ── 3. Guard: already approved ────────────────────────────────────
    if (review.isApproved) {
      return NextResponse.json(
        {
          error: "This document has already been approved.",
          data: {
            reviewId:   review.id,
            approvedAt: review.approvedAt,
            isApproved: true,
          },
        },
        { status: 409 }
      )
    }

    // ── 4. Guard: feedback must exist before approving ─────────────────
    if (!review.feedback || review.feedback.trim().length === 0) {
      return NextResponse.json(
        {
          error:
            "Please add feedback before approving. " +
            "Students need feedback to understand what was reviewed.",
        },
        { status: 400 }
      )
    }

    const now = new Date()

    // ── 5. Mark review as approved + update document status ───────────
    const [updatedReview] = await prisma.$transaction([
      prisma.review.update({
        where: { id: reviewId },
        data: {
          isApproved: true,
          approvedAt: now,
          updatedAt:  now,
        },
        select: {
          id:           true,
          isApproved:   true,
          approvedAt:   true,
          feedback:     true,
          feedbackType: true,
          updatedAt:    true,
        },
      }),
      prisma.document.update({
        where: { id: review.documentId },
        data: {
          status:    "APPROVED",
          updatedAt: now,
        },
      }),
    ])

    // ── 6. Email all students in the project ──────────────────────────
    const { document } = review
    const { project }  = document
    const students     = project.students

    const documentType =
      document.type === "SRS" || document.type === "OPPM"
        ? document.type
        : "SRS"

    if (students.length > 0 && review.feedback) {
      // Fire-and-forget: don't block the response on email delivery
      Promise.allSettled(
        students.map((student) =>
          sendApprovalNotificationEmail(
            student.email,
            student.name,
            document.name,
            documentType,
            project.name,
            review.feedback!
          ).catch((err) => {
            console.error(
              `[reviews/[id]/approve] Failed to send approval email to ${student.email}:`,
              err
            )
          })
        )
      )
    }

    // ── 7. Return success ─────────────────────────────────────────────
    return NextResponse.json({
      data: {
        reviewId:     updatedReview.id,
        documentId:   review.documentId,
        documentName: document.name,
        documentType: document.type,
        projectName:  project.name,
        isApproved:   updatedReview.isApproved,
        approvedAt:   updatedReview.approvedAt,
        studentsNotified: students.length,
      },
      message: `"${document.name}" has been approved. ${
        students.length > 0
          ? `${students.length} student${students.length !== 1 ? "s" : ""} will be notified by email.`
          : "No students are registered in this project to notify."
      }`,
    })
  } catch (err) {
    console.error("[reviews/[id]/approve] Unexpected error:", err)
    return NextResponse.json(
      { error: "An unexpected error occurred while approving the document." },
      { status: 500 }
    )
  }
}

// ─────────────────────────────────────────────
// DELETE /api/reviews/[id]/approve
// Revokes approval (e.g. if advisor changes their mind)
// Resets document status → REVIEWED
// ─────────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorised." }, { status: 401 })
    }

    const { id: reviewId } = await params

    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        document: {
          select: {
            id:   true,
            name: true,
            type: true,
            project: {
              select: {
                advisorId: true,
                name:      true,
              },
            },
          },
        },
      },
    })

    if (!review) {
      return NextResponse.json(
        { error: "Review not found." },
        { status: 404 }
      )
    }

    if (review.document.project.advisorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }

    if (!review.isApproved) {
      return NextResponse.json(
        { error: "This document has not been approved yet." },
        { status: 409 }
      )
    }

    const now = new Date()

    await prisma.$transaction([
      prisma.review.update({
        where: { id: reviewId },
        data: {
          isApproved: false,
          approvedAt: null,
          updatedAt:  now,
        },
      }),
      prisma.document.update({
        where: { id: review.documentId },
        data: {
          status:    "REVIEWED",
          updatedAt: now,
        },
      }),
    ])

    return NextResponse.json({
      message: `Approval for "${review.document.name}" has been revoked. The document is now back in Reviewed status.`,
    })
  } catch (err) {
    console.error("[reviews/[id]/approve:DELETE] Unexpected error:", err)
    return NextResponse.json(
      { error: "An unexpected error occurred while revoking approval." },
      { status: 500 }
    )
  }
}
