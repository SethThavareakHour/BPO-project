import "server-only";

import { prisma } from "@/lib/db";
import {
  ReviewProviderUnavailableError,
  isReviewProviderConfigured,
  reviewDocument,
} from "@/lib/ai";

type ReviewableDocument = {
  id: string;
  name: string;
  type: "SRS" | "OPPM" | "UNKNOWN";
  status: "PENDING" | "REVIEWING" | "REVIEWED" | "APPROVED";
  extraction?: {
    text: string | null;
    status: "PENDING" | "EXTRACTED" | "FAILED";
  } | null;
};

export async function generateReviewFromExtraction(document: ReviewableDocument) {
  if (document.type !== "SRS" && document.type !== "OPPM") {
    return {
      ok: false as const,
      status: 400,
      error:
        "Cannot review this document because its type could not be determined.",
    };
  }

  if (document.status === "APPROVED") {
    return {
      ok: false as const,
      status: 409,
      error: "This document has already been approved and cannot be re-reviewed.",
    };
  }

  if (!document.extraction || document.extraction.status !== "EXTRACTED") {
    return {
      ok: false as const,
      status: 422,
      error: "The document has not been successfully extracted yet.",
    };
  }

  const text = document.extraction.text?.trim() ?? "";
  if (text.length < 50) {
    return {
      ok: false as const,
      status: 422,
      error:
        "The document appears to be empty or contains too little text to review.",
    };
  }

  if (!isReviewProviderConfigured()) {
    return {
      ok: false as const,
      status: 501,
      error:
        "LLM review is not configured yet. Set DeepSeek credentials to enable review generation.",
    };
  }

  const now = new Date();
  await prisma.document.update({
    where: { id: document.id },
    data: { status: "REVIEWING" },
  });

  try {
    const aiReport = await reviewDocument(text, document.type);
    const review = await prisma.review.upsert({
      where: { documentId: document.id },
      create: {
        documentId: document.id,
        aiReport: aiReport as object,
        feedback: null,
        feedbackType: null,
        isApproved: false,
        approvedAt: null,
      },
      update: {
        aiReport: aiReport as object,
        feedback: null,
        feedbackType: null,
        isApproved: false,
        approvedAt: null,
        updatedAt: now,
      },
    });

    await prisma.document.update({
      where: { id: document.id },
      data: {
        status: "REVIEWED",
        driveSyncStatus: "SYNCED",
        needsReview: false,
        reviewCount: { increment: 1 },
        lastReviewedAt: now,
      },
    });

    return { ok: true as const, review };
  } catch (err) {
    await prisma.document.update({
      where: { id: document.id },
      data: { status: "PENDING", needsReview: true },
    });

    if (err instanceof ReviewProviderUnavailableError) {
      return {
        ok: false as const,
        status: 501,
        error:
          "LLM review is not configured yet. Set DeepSeek credentials to enable review generation.",
      };
    }

    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false as const,
      status: 502,
      error: `AI review failed: ${message}`,
    };
  }
}
