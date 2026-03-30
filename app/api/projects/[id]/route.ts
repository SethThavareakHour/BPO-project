import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

const updateProjectSchema = z.object({
  name: z
    .string()
    .min(2, "Project name must be at least 2 characters")
    .max(150, "Project name must be at most 150 characters")
    .trim()
    .optional(),
  description: z
    .string()
    .max(500, "Description must be at most 500 characters")
    .trim()
    .nullable()
    .optional(),
  driveFolderId: z
    .string()
    .trim()
    .nullable()
    .optional(),
})

// ─────────────────────────────────────────────
// GET /api/projects/[id]
// Returns a single project with students + documents + reviews
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

    const { id } = await params

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        students: {
          orderBy: { createdAt: "asc" },
        },
        documents: {
          orderBy: { createdAt: "desc" },
          include: {
            review: {
              select: {
                id: true,
                isApproved: true,
                feedbackType: true,
                feedback: true,
                createdAt: true,
              },
            },
          },
        },
      },
    })

    if (!project) {
      return NextResponse.json(
        { error: "Project not found." },
        { status: 404 }
      )
    }

    // Ensure the project belongs to the logged-in advisor
    if (project.advisorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }

    return NextResponse.json({ data: project })
  } catch (err) {
    console.error("[projects/[id]:GET] Unexpected error:", err)
    return NextResponse.json(
      { error: "Failed to fetch project." },
      { status: 500 }
    )
  }
}

// ─────────────────────────────────────────────
// PATCH /api/projects/[id]
// Updates project name, description, or driveFolderId
// ─────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorised." }, { status: 401 })
    }

    const { id } = await params

    // Ownership check
    const existing = await prisma.project.findUnique({
      where: { id },
      select: { advisorId: true },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Project not found." },
        { status: 404 }
      )
    }

    if (existing.advisorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }

    const body = await req.json().catch(() => null)

    if (!body) {
      return NextResponse.json(
        { error: "Invalid or missing request body." },
        { status: 400 }
      )
    }

    const parsed = updateProjectSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 422 }
      )
    }

    const { name, description, driveFolderId } = parsed.data

    const updated = await prisma.project.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(driveFolderId !== undefined && { driveFolderId }),
      },
      include: {
        _count: {
          select: {
            students: true,
            documents: true,
          },
        },
      },
    })

    return NextResponse.json({
      data: updated,
      message: "Project updated successfully.",
    })
  } catch (err) {
    console.error("[projects/[id]:PATCH] Unexpected error:", err)
    return NextResponse.json(
      { error: "Failed to update project." },
      { status: 500 }
    )
  }
}

// ─────────────────────────────────────────────
// DELETE /api/projects/[id]
// Deletes the project and all related data (cascade)
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

    const { id } = await params

    // Ownership check
    const existing = await prisma.project.findUnique({
      where: { id },
      select: { advisorId: true, name: true },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Project not found." },
        { status: 404 }
      )
    }

    if (existing.advisorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }

    await prisma.project.delete({ where: { id } })

    return NextResponse.json({
      message: `Project "${existing.name}" deleted successfully.`,
    })
  } catch (err) {
    console.error("[projects/[id]:DELETE] Unexpected error:", err)
    return NextResponse.json(
      { error: "Failed to delete project." },
      { status: 500 }
    )
  }
}
