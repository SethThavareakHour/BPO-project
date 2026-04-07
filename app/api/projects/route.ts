import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { createDriveFolder } from "@/lib/drive"

const createProjectSchema = z.object({
  name: z
    .string()
    .min(2, "Project name must be at least 2 characters")
    .max(150, "Project name must be at most 150 characters")
    .trim(),
  description: z
    .string()
    .max(500, "Description must be at most 500 characters")
    .trim()
    .optional()
    .or(z.literal(""))
    .nullable(),
  driveFolderId: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .nullable(),
  studentName: z.string().trim().optional().or(z.literal("")).nullable(),
  studentEmail: z
    .string()
    .trim()
    .email("Invalid email")
    .optional()
    .or(z.literal(""))
    .nullable(),
})

// ─────────────────────────────────────────────
// GET /api/projects
// Returns all projects belonging to the logged-in advisor
// with student + document counts
// ─────────────────────────────────────────────
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorised." }, { status: 401 })
    }

    const projects = await prisma.project.findMany({
      where: { advisorId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            students: true,
            documents: true,
          },
        },
        documents: {
          select: {
            status: true,
            type: true,
          },
        },
      },
    })

    // Enrich with pending review count per project
    const enriched = projects.map((p) => {
      const pendingCount = p.documents.filter(
        (d) => d.status === "PENDING" || d.status === "REVIEWING" || d.status === "REVIEWED"
      ).length

      const srsCount = p.documents.filter(d => d.type === "SRS").length
      const oppmCount = p.documents.filter(d => d.type === "OPPM").length

      return {
        id: p.id,
        name: p.name,
        description: p.description,
        driveFolderId: p.driveFolderId,
        advisorId: p.advisorId,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        _count: p._count,
        pendingCount,
        srsCount,
        oppmCount,
      }
    })

    return NextResponse.json({ data: enriched })
  } catch (err) {
    console.error("[projects:GET] Unexpected error:", err)
    return NextResponse.json(
      { error: "Failed to fetch projects." },
      { status: 500 }
    )
  }
}

// ─────────────────────────────────────────────
// POST /api/projects
// Creates a new project for the logged-in advisor
// ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorised." }, { status: 401 })
    }

    const body = await req.json().catch(() => null)

    if (!body) {
      return NextResponse.json(
        { error: "Invalid or missing request body." },
        { status: 400 }
      )
    }

    const parsed = createProjectSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 422 }
      )
    }

    const { name, description, driveFolderId, studentName, studentEmail } = parsed.data

    let finalDriveFolderId = driveFolderId;

    // Auto-create a Google Drive folder if one wasn't provided
    if (!finalDriveFolderId) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { email: true },
        });

        const shareWith = [];
        if (user?.email) shareWith.push(user.email);
        if (studentEmail) shareWith.push(studentEmail);

        if (shareWith.length > 0) {
          finalDriveFolderId = await createDriveFolder(
            `[BPO Project] ${name}`,
            shareWith
          );
        }
      } catch (folderErr) {
        console.error("Failed to auto-create Drive folder:", folderErr);
      }
    }

    const project = await prisma.project.create({
      data: {
        name,
        description: description ?? null,
        driveFolderId: finalDriveFolderId ?? null,
        advisorId: session.user.id,
        // If student details provided, create them immediately
        students: studentName && studentEmail ? {
          create: {
            name: studentName,
            email: studentEmail,
          }
        } : undefined,
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

    return NextResponse.json(
      { data: project, message: "Project created successfully." },
      { status: 201 }
    )
  } catch (err) {
    console.error("[projects:POST] Unexpected error:", err)
    return NextResponse.json(
      { error: "Failed to create project." },
      { status: 500 }
    )
  }
}
