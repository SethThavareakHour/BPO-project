import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { listFilesInFolder, detectDocumentType } from "@/lib/drive"
import { isSupportedMimeType } from "@/lib/utils"

const scanSchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
})

// ─────────────────────────────────────────────
// POST /api/drive/scan
// Scans the Google Drive folder linked to a project,
// detects new SRS / OPPM files, and persists them to the DB.
// ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorised." }, { status: 401 })
    }

    // ── 1. Parse body ─────────────────────────────────────────────────
    const body = await req.json().catch(() => null)

    if (!body) {
      return NextResponse.json(
        { error: "Invalid or missing request body." },
        { status: 400 }
      )
    }

    const parsed = scanSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 422 }
      )
    }

    const { projectId } = parsed.data

    // ── 2. Verify project ownership ───────────────────────────────────
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        advisorId: true,
        driveFolderId: true,
      },
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

    if (!project.driveFolderId) {
      return NextResponse.json(
        {
          error:
            "No Google Drive folder is linked to this project. " +
            "Please add a Drive Folder ID in the project settings first.",
        },
        { status: 400 }
      )
    }

    // ── 3. List files currently in the Drive folder ───────────────────
    let driveFiles
    try {
      driveFiles = await listFilesInFolder(project.driveFolderId)
    } catch (driveError) {
      const message =
        driveError instanceof Error ? driveError.message : String(driveError)
      return NextResponse.json(
        {
          error: `Failed to access Google Drive folder: ${message}`,
        },
        { status: 502 }
      )
    }

    if (driveFiles.length === 0) {
      return NextResponse.json({
        data: {
          newFiles: [],
          skippedFiles: [],
          totalScanned: 0,
          projectId,
          message: "No files found in the Drive folder.",
        },
      })
    }

    // ── 4. Fetch already-known Drive file IDs for this project ────────
    const existingDocs = await prisma.document.findMany({
      where: { projectId },
      select: { driveFileId: true },
    })

    const knownFileIds = new Set(existingDocs.map((d) => d.driveFileId))

    // ── 5. Determine which files are genuinely new ─────────────────────
    const newDriveFiles = driveFiles.filter((f) => !knownFileIds.has(f.id))

    // ── 6. Filter to supported MIME types ────────────────────────────
    const supportedNewFiles = newDriveFiles.filter((f) =>
      isSupportedMimeType(f.mimeType)
    )

    const skippedFiles = newDriveFiles
      .filter((f) => !isSupportedMimeType(f.mimeType))
      .map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        reason: "Unsupported file type. Only PDF, DOCX, Google Docs, and plain text files are supported.",
      }))

    // ── 7. Persist new documents to the database ──────────────────────
    const createdDocuments = await Promise.all(
      supportedNewFiles.map(async (file) => {
        const type = detectDocumentType(file.name)

        return prisma.document.create({
          data: {
            name: file.name,
            type,
            driveFileId: file.id,
            mimeType: file.mimeType,
            driveUrl: file.webViewLink ?? null,
            status: "PENDING",
            projectId,
          },
          select: {
            id: true,
            name: true,
            type: true,
            driveFileId: true,
            mimeType: true,
            driveUrl: true,
            status: true,
            createdAt: true,
          },
        })
      })
    )

    // ── 8. Return scan results ────────────────────────────────────────
    return NextResponse.json({
      data: {
        newFiles: createdDocuments,
        skippedFiles,
        totalScanned: driveFiles.length,
        projectId,
        message:
          createdDocuments.length > 0
            ? `Found ${createdDocuments.length} new file${createdDocuments.length !== 1 ? "s" : ""}. Ready for AI review.`
            : "No new files found. All files in this folder have already been imported.",
      },
    })
  } catch (err) {
    console.error("[drive/scan] Unexpected error:", err)
    return NextResponse.json(
      { error: "An unexpected error occurred during the Drive scan." },
      { status: 500 }
    )
  }
}
