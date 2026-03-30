import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

// ─────────────────────────────────────────────
// GET /api/reviews/[id]
// Returns the full review including the complete AI report JSON.
// [id] is the Review ID.
// ─────────────────────────────────────────────
export async function GET(
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
          include: {
            project: {
              select: {
                id:        true,
                name:      true,
                advisorId: true,
                students:  {
                  select: {
                    id:        true,
                    name:      true,
                    email:     true,
                    studentId: true,
                  },
                  orderBy: { createdAt: "asc" },
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

    // Ownership guard
    if (review.document.project.advisorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }

    return NextResponse.json({ data: review })
  } catch (err) {
    console.error("[reviews/[id]:GET] Unexpected error:", err)
    return NextResponse.json(
      { error: "Failed to fetch review." },
      { status: 500 }
    )
  }
}

// ─────────────────────────────────────────────
// DELETE /api/reviews/[id]
// Deletes the review and resets the document status back to PENDING.
// Useful if the advisor wants to regenerate a fresh review.
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
            id:     true,
            name:   true,
            status: true,
            project: {
              select: { advisorId: true },
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

    // Ownership guard
    if (review.document.project.advisorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }

    // Cannot delete an approved review
    if (review.isApproved) {
      return NextResponse.json(
        {
          error:
            "Cannot delete an approved review. " +
            "Revoke the approval first if you need to regenerate the review.",
        },
        { status: 409 }
      )
    }

    // Delete review + reset document status in a transaction
    await prisma.$transaction([
      prisma.review.delete({ where: { id: reviewId } }),
      prisma.document.update({
        where: { id: review.documentId },
        data:  { status: "PENDING", updatedAt: new Date() },
      }),
    ])

    return NextResponse.json({
      message: `Review for "${review.document.name}" has been deleted. The document is now back in Pending status.`,
    })
  } catch (err) {
    console.error("[reviews/[id]:DELETE] Unexpected error:", err)
    return NextResponse.json(
      { error: "Failed to delete review." },
      { status: 500 }
    )
  }
}
