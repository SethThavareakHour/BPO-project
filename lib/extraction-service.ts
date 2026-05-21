import "server-only";

import { prisma } from "@/lib/db";
import { extractTextFromFileWithMethod } from "@/lib/drive";

type ExtractableDocument = {
  id: string;
  name: string;
  driveFileId: string;
  mimeType: string | null;
  driveModifiedTime: Date | null;
};

export async function extractAndStoreDocumentText(document: ExtractableDocument) {
  const now = new Date();

  try {
    const result = await extractTextFromFileWithMethod(
      document.driveFileId,
      document.mimeType ?? "application/pdf",
      document.name,
    );

    if (!result.text || result.text.trim().length < 50) {
      throw new Error(
        "The document contains too little readable text to review.",
      );
    }

    const extraction = await prisma.documentExtraction.upsert({
      where: { documentId: document.id },
      create: {
        documentId: document.id,
        text: result.text,
        status: "EXTRACTED",
        method: result.method,
        error: null,
        sourceModifiedTime: document.driveModifiedTime,
        extractedAt: now,
      },
      update: {
        text: result.text,
        status: "EXTRACTED",
        method: result.method,
        error: null,
        sourceModifiedTime: document.driveModifiedTime,
        extractedAt: now,
        updatedAt: now,
      },
    });

    return { ok: true as const, extraction };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    const extraction = await prisma.documentExtraction.upsert({
      where: { documentId: document.id },
      create: {
        documentId: document.id,
        text: null,
        status: "FAILED",
        method: "UNSUPPORTED",
        error: message,
        sourceModifiedTime: document.driveModifiedTime,
        extractedAt: null,
      },
      update: {
        text: null,
        status: "FAILED",
        method: "UNSUPPORTED",
        error: message,
        sourceModifiedTime: document.driveModifiedTime,
        extractedAt: null,
        updatedAt: now,
      },
    });

    return { ok: false as const, extraction, error: message };
  }
}
