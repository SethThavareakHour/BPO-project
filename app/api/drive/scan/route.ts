import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  detectDocumentType,
  isReviewCandidateName,
  listFilesInFolder,
} from "@/lib/drive"
import { extractAndStoreDocumentText } from "@/lib/extraction-service"
import { generateReviewFromExtraction } from "@/lib/review-service"
import { isSupportedMimeType } from "@/lib/utils"
import type { DriveFile } from "@/types"

const scanSchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
})

type ScanDocument = Awaited<ReturnType<typeof selectDocument>>

const documentSelect = {
  id: true,
  name: true,
  type: true,
  driveFileId: true,
  mimeType: true,
  driveUrl: true,
  status: true,
  driveCreatedTime: true,
  driveModifiedTime: true,
  driveLastSeenAt: true,
  driveLastSyncedAt: true,
  driveSyncStatus: true,
  needsReview: true,
  reviewCount: true,
  lastReviewedAt: true,
  projectId: true,
  createdAt: true,
  updatedAt: true,
  extraction: {
    select: {
      id: true,
      status: true,
      method: true,
      error: true,
      extractedAt: true,
      sourceModifiedTime: true,
    },
  },
  review: {
    select: {
      id: true,
      isApproved: true,
      feedbackType: true,
      feedback: true,
      approvedAt: true,
      createdAt: true,
    },
  },
} as const

async function selectDocument(documentId: string) {
  return prisma.document.findUniqueOrThrow({
    where: { id: documentId },
    select: documentSelect,
  })
}

async function writeEvent(
  documentId: string,
  eventType:
    | "IMPORTED"
    | "MODIFIED"
    | "UNCHANGED"
    | "EXTRACTED"
    | "EXTRACTION_FAILED"
    | "REVIEWED"
    | "REVIEW_FAILED"
    | "APPROVED_IGNORED",
  driveModifiedTime: Date | null,
  message?: string,
) {
  await prisma.documentScanEvent.create({
    data: {
      documentId,
      eventType,
      driveModifiedTime,
      message,
    },
  })
}

function toDriveDate(value: string | null): Date | null {
  return value ? new Date(value) : null
}

function hasDriveChange(
  stored: Date | null,
  incoming: Date | null,
): boolean {
  if (!incoming) return false
  return (stored?.getTime() ?? null) !== incoming.getTime()
}

// ─────────────────────────────────────────────
// POST /api/drive/scan
// Manually scans the project's configured Drive folder, imports SRS/OPPM
// candidates, extracts text, and auto-reviews successful extractions.
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
        { status: 400 },
      )
    }

    const parsed = scanSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 422 },
      )
    }

    const { projectId } = parsed.data

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        advisorId: true,
        driveFolderId: true,
      },
    })

    if (!project) {
      return NextResponse.json(
        { error: "Project not found." },
        { status: 404 },
      )
    }

    if (project.advisorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }

    const folderId =
      project.driveFolderId ?? process.env.GOOGLE_DEFAULT_DRIVE_FOLDER_ID

    if (!folderId) {
      return NextResponse.json(
        {
          error:
            "No Google Drive folder is linked to this project and GOOGLE_DEFAULT_DRIVE_FOLDER_ID is not configured.",
        },
        { status: 400 },
      )
    }

    let driveFiles: DriveFile[]
    try {
      driveFiles = await listFilesInFolder(folderId)
    } catch (driveError) {
      const message =
        driveError instanceof Error ? driveError.message : String(driveError)
      return NextResponse.json(
        { error: `Failed to access Google Drive folder: ${message}` },
        { status: 502 },
      )
    }

    const now = new Date()
    const candidates = driveFiles.filter((file) => isReviewCandidateName(file.name))

    const existingDocs = await prisma.document.findMany({
      where: { projectId },
      select: {
        id: true,
        driveFileId: true,
        driveModifiedTime: true,
        status: true,
        extraction: {
          select: {
            id: true,
            status: true,
            sourceModifiedTime: true,
          },
        },
        review: {
          select: {
            id: true,
            isApproved: true,
          },
        },
      },
    })

    const existingByDriveId = new Map(
      existingDocs.map((doc) => [doc.driveFileId, doc]),
    )

    const newFiles: ScanDocument[] = []
    const modifiedFiles: ScanDocument[] = []
    const unchangedFiles: ScanDocument[] = []
    const skippedFiles: Array<{
      id: string
      name: string
      mimeType: string
      reason: string
    }> = []

    const summary = {
      imported: 0,
      modified: 0,
      unchanged: 0,
      extracted: 0,
      reviewed: 0,
      failed: 0,
      skipped: 0,
      approvedIgnored: 0,
    }

    for (const file of candidates) {
      const type = detectDocumentType(file.name)
      const driveCreatedTime = toDriveDate(file.createdTime)
      const driveModifiedTime = toDriveDate(file.modifiedTime)
      const existing = existingByDriveId.get(file.id)
      const supported = isSupportedMimeType(file.mimeType)

      let documentId: string
      let eventType: "IMPORTED" | "MODIFIED" | "UNCHANGED"
      let shouldProcess = false

      if (!existing) {
        const created = await prisma.document.create({
          data: {
            name: file.name,
            type,
            driveFileId: file.id,
            mimeType: file.mimeType,
            driveUrl: file.webViewLink ?? null,
            status: "PENDING",
            driveCreatedTime,
            driveModifiedTime,
            driveLastSeenAt: now,
            driveLastSyncedAt: now,
            driveSyncStatus: "NEW",
            needsReview: supported,
            projectId,
          },
          select: { id: true },
        })
        documentId = created.id
        eventType = "IMPORTED"
        shouldProcess = supported
        summary.imported += 1
        await writeEvent(documentId, "IMPORTED", driveModifiedTime, "Imported from Drive scan.")
      } else {
        documentId = existing.id

        if (existing.status === "APPROVED" || existing.review?.isApproved) {
          await prisma.document.update({
            where: { id: documentId },
            data: { driveLastSeenAt: now },
          })
          await writeEvent(
            documentId,
            "APPROVED_IGNORED",
            driveModifiedTime,
            "Approved document ignored by scan.",
          )
          summary.approvedIgnored += 1
          unchangedFiles.push(await selectDocument(documentId))
          continue
        }

        const changed = hasDriveChange(existing.driveModifiedTime, driveModifiedTime)
        const missingExtraction = !existing.extraction
        const staleExtraction =
          Boolean(existing.extraction?.sourceModifiedTime && driveModifiedTime) &&
          existing.extraction?.sourceModifiedTime?.getTime() !==
            driveModifiedTime?.getTime()

        eventType = changed ? "MODIFIED" : "UNCHANGED"
        shouldProcess =
          supported &&
          (changed || missingExtraction || staleExtraction || existing.extraction?.status === "FAILED")

        await prisma.document.update({
          where: { id: documentId },
          data: {
            name: file.name,
            type,
            mimeType: file.mimeType,
            driveUrl: file.webViewLink ?? null,
            driveCreatedTime,
            driveModifiedTime,
            driveLastSeenAt: now,
            driveLastSyncedAt: now,
            driveSyncStatus: changed ? "MODIFIED" : existing.extraction ? "SYNCED" : "NEW",
            needsReview: shouldProcess || type !== "UNKNOWN",
            status: changed ? "PENDING" : undefined,
          },
        })

        if (changed) summary.modified += 1
        else summary.unchanged += 1
        await writeEvent(documentId, eventType, driveModifiedTime)
      }

      if (!supported) {
        const reason =
          "Unsupported file type. Supported: PDF, Word, Excel, CSV, text, images, and Google Docs/Sheets/Slides."
        skippedFiles.push({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          reason,
        })
        summary.skipped += 1
        summary.failed += 1

        await prisma.documentExtraction.upsert({
          where: { documentId },
          create: {
            documentId,
            text: null,
            status: "FAILED",
            method: "UNSUPPORTED",
            error: reason,
            sourceModifiedTime: driveModifiedTime,
            extractedAt: null,
          },
          update: {
            text: null,
            status: "FAILED",
            method: "UNSUPPORTED",
            error: reason,
            sourceModifiedTime: driveModifiedTime,
            extractedAt: null,
            updatedAt: now,
          },
        })
        await writeEvent(documentId, "EXTRACTION_FAILED", driveModifiedTime, reason)
      } else if (shouldProcess) {
        const extractionResult = await extractAndStoreDocumentText({
          id: documentId,
          name: file.name,
          driveFileId: file.id,
          mimeType: file.mimeType,
          driveModifiedTime,
        })

        if (!extractionResult.ok) {
          summary.failed += 1
          await writeEvent(
            documentId,
            "EXTRACTION_FAILED",
            driveModifiedTime,
            extractionResult.error,
          )
        } else {
          summary.extracted += 1
          await writeEvent(
            documentId,
            "EXTRACTED",
            driveModifiedTime,
            `Extracted with ${extractionResult.extraction.method}.`,
          )

          const reviewResult = await generateReviewFromExtraction({
            id: documentId,
            name: file.name,
            type,
            status: "PENDING",
            extraction: {
              text: extractionResult.extraction.text,
              status: extractionResult.extraction.status,
            },
          })

          if (reviewResult.ok) {
            summary.reviewed += 1
            await writeEvent(documentId, "REVIEWED", driveModifiedTime, "AI review generated.")
          } else {
            summary.failed += 1
            await writeEvent(
              documentId,
              "REVIEW_FAILED",
              driveModifiedTime,
              reviewResult.error,
            )
          }
        }
      }

      const selected = await selectDocument(documentId)
      if (eventType === "IMPORTED") newFiles.push(selected)
      else if (eventType === "MODIFIED") modifiedFiles.push(selected)
      else unchangedFiles.push(selected)
    }

    const changedCount = summary.imported + summary.modified
    const message =
      changedCount > 0 || summary.extracted > 0 || summary.reviewed > 0
        ? `Scan complete: ${summary.imported} imported, ${summary.modified} modified, ${summary.extracted} extracted, ${summary.reviewed} reviewed.`
        : "Drive scan complete. No new or modified SRS/OPPM files found."

    return NextResponse.json({
      data: {
        newFiles,
        modifiedFiles,
        unchangedFiles,
        skippedFiles,
        totalScanned: driveFiles.length,
        totalCandidates: candidates.length,
        projectId,
        folderId,
        summary,
        message,
      },
    })
  } catch (err) {
    console.error("[drive/scan] Unexpected error:", err)
    return NextResponse.json(
      { error: "An unexpected error occurred during the Drive scan." },
      { status: 500 },
    )
  }
}
