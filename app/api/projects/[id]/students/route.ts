import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

const createStudentSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters")
    .trim(),
  email: z
    .string()
    .email("Invalid email address")
    .toLowerCase()
    .trim(),
  studentId: z
    .string()
    .max(50, "Student ID must be at most 50 characters")
    .trim()
    .optional(),
})

// ─────────────────────────────────────────────
// GET /api/projects/[id]/students
// Returns all students in a project
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

    const { id: projectId } = await params

    // Verify project ownership
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { advisorId: true },
    })

    if (!project) {
      return NextResponse.json(
        { error: "Project not found." },
        { status: 404 }
      )
    }

    if (project.advisorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }

    const students = await prisma.student.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json({ data: students })
  } catch (err) {
    console.error("[projects/[id]/students:GET] Unexpected error:", err)
    return NextResponse.json(
      { error: "Failed to fetch students." },
      { status: 500 }
    )
  }
}

// ─────────────────────────────────────────────
// POST /api/projects/[id]/students
// Adds a student to the project
// ─────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorised." }, { status: 401 })
    }

    const { id: projectId } = await params

    // Verify project ownership
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { advisorId: true },
    })

    if (!project) {
      return NextResponse.json(
        { error: "Project not found." },
        { status: 404 }
      )
    }

    if (project.advisorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }

    const body = await req.json().catch(() => null)

    if (!body) {
      return NextResponse.json(
        { error: "Invalid or missing request body." },
        { status: 400 }
      )
    }

    const parsed = createStudentSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 422 }
      )
    }

    const { name, email, studentId } = parsed.data

    // Check for duplicate email within the same project
    const duplicate = await prisma.student.findFirst({
      where: { projectId, email },
      select: { id: true },
    })

    if (duplicate) {
      return NextResponse.json(
        {
          error: "A student with this email address is already in this project.",
        },
        { status: 409 }
      )
    }

    const student = await prisma.student.create({
      data: {
        name,
        email,
        studentId: studentId ?? null,
        projectId,
      },
    })

    return NextResponse.json(
      { data: student, message: "Student added successfully." },
      { status: 201 }
    )
  } catch (err) {
    console.error("[projects/[id]/students:POST] Unexpected error:", err)
    return NextResponse.json(
      { error: "Failed to add student." },
      { status: 500 }
    )
  }
}

// ─────────────────────────────────────────────
// DELETE /api/projects/[id]/students
// Removes a student from the project by studentId (query param)
// e.g. DELETE /api/projects/abc/students?studentId=xyz
// ─────────────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorised." }, { status: 401 })
    }

    const { id: projectId } = await params
    const { searchParams } = new URL(req.url)
    const studentId = searchParams.get("studentId")

    if (!studentId) {
      return NextResponse.json(
        { error: "studentId query parameter is required." },
        { status: 400 }
      )
    }

    // Verify project ownership
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { advisorId: true },
    })

    if (!project) {
      return NextResponse.json(
        { error: "Project not found." },
        { status: 404 }
      )
    }

    if (project.advisorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }

    // Confirm the student belongs to this project
    const student = await prisma.student.findFirst({
      where: { id: studentId, projectId },
      select: { id: true, name: true },
    })

    if (!student) {
      return NextResponse.json(
        { error: "Student not found in this project." },
        { status: 404 }
      )
    }

    await prisma.student.delete({ where: { id: studentId } })

    return NextResponse.json({
      message: `Student "${student.name}" removed from the project.`,
    })
  } catch (err) {
    console.error("[projects/[id]/students:DELETE] Unexpected error:", err)
    return NextResponse.json(
      { error: "Failed to remove student." },
      { status: 500 }
    )
  }
}
