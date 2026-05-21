import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  ReviewProviderUnavailableError,
  generateFeedbackFromReport,
  isReviewProviderConfigured,
} from "@/lib/ai";
import type { AIReport } from "@/types";

const feedbackSchema = z.object({
  feedbackType: z.enum(["AI_GENERATED", "MANUAL"], {
    message: "feedbackType must be 'AI_GENERATED' or 'MANUAL'",
  }),
  // Required only when feedbackType is MANUAL
  feedback: z
    .string()
    .max(5000, "Feedback must be at most 5000 characters")
    .trim()
    .optional(),
});

// ─────────────────────────────────────────────
// POST /api/reviews/[id]/feedback
// [id] is the Review ID.
//
// feedbackType = "AI_GENERATED"
//   → Calls the AI to write feedback from the existing aiReport,
//     saves it, and returns it.
//
// feedbackType = "MANUAL"
//   → Saves the advisor-written feedback text.
//
// In both cases the document status stays as REVIEWED
// (it only moves to APPROVED via the /approve route).
// ─────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
    }

    const { id: reviewId } = await params;

    // ── 1. Load the review with its document + project ────────────────
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        document: {
          select: {
            id: true,
            name: true,
            type: true,
            status: true,
            project: {
              select: {
                id: true,
                name: true,
                advisorId: true,
              },
            },
          },
        },
      },
    });

    if (!review) {
      return NextResponse.json({ error: "Review not found." }, { status: 404 });
    }

    // ── 2. Ownership guard ────────────────────────────────────────────
    if (review.document.project.advisorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    // ── 3. Guard: cannot edit feedback on an approved document ────────
    if (review.isApproved) {
      return NextResponse.json(
        {
          error:
            "This document has already been approved. " +
            "Feedback can no longer be modified.",
        },
        { status: 409 },
      );
    }

    // ── 4. Parse + validate body ──────────────────────────────────────
    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { error: "Invalid or missing request body." },
        { status: 400 },
      );
    }

    const parsed = feedbackSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 422 },
      );
    }

    const { feedbackType, feedback: manualFeedback } = parsed.data;

    // ── 5. Manual feedback: require the text field ────────────────────
    if (feedbackType === "MANUAL") {
      if (!manualFeedback || manualFeedback.length < 10) {
        return NextResponse.json(
          {
            error:
              "Manual feedback must be at least 10 characters. " +
              "Please provide a meaningful feedback message.",
          },
          { status: 422 },
        );
      }

      const updated = await prisma.review.update({
        where: { id: reviewId },
        data: {
          feedback: manualFeedback,
          feedbackType: "MANUAL",
          updatedAt: new Date(),
        },
        select: {
          id: true,
          feedback: true,
          feedbackType: true,
          isApproved: true,
          updatedAt: true,
        },
      });

      return NextResponse.json({
        data: updated,
        message: "Feedback saved successfully.",
      });
    }

    // ── 6. AI-generated feedback ──────────────────────────────────────
    if (!isReviewProviderConfigured()) {
      return NextResponse.json(
        {
          error:
            "AI feedback is not configured yet. Manual feedback still works.",
        },
        { status: 501 },
      );
    }

    // The AI report must already exist (document must have been reviewed first)
    if (!review.aiReport) {
      return NextResponse.json(
        {
          error:
            "No AI report exists for this review yet. " +
            "Please generate the AI review first before requesting AI feedback.",
        },
        { status: 400 },
      );
    }

    let generatedFeedback: string;

    try {
      generatedFeedback = await generateFeedbackFromReport(
        review.aiReport as unknown as AIReport,
        review.document.name,
        review.document.project.name,
      );
    } catch (aiError) {
      if (aiError instanceof ReviewProviderUnavailableError) {
        return NextResponse.json(
          {
            error:
              "AI feedback is not configured yet. Manual feedback still works.",
          },
          { status: 501 },
        );
      }

      const message =
        aiError instanceof Error ? aiError.message : String(aiError);

      return NextResponse.json(
        {
          error: `AI feedback generation failed: ${message}`,
        },
        { status: 502 },
      );
    }

    // ── 7. Persist AI-generated feedback ─────────────────────────────
    const updated = await prisma.review.update({
      where: { id: reviewId },
      data: {
        feedback: generatedFeedback,
        feedbackType: "AI_GENERATED",
        updatedAt: new Date(),
      },
      select: {
        id: true,
        feedback: true,
        feedbackType: true,
        isApproved: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      data: updated,
      message: "AI feedback generated and saved successfully.",
    });
  } catch (err) {
    console.error("[reviews/[id]/feedback] Unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred while saving feedback." },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
// GET /api/reviews/[id]/feedback
// Returns the current feedback for a review
// ─────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
    }

    const { id: reviewId } = await params;

    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      select: {
        id: true,
        feedback: true,
        feedbackType: true,
        isApproved: true,
        updatedAt: true,
        document: {
          select: {
            project: {
              select: { advisorId: true },
            },
          },
        },
      },
    });

    if (!review) {
      return NextResponse.json({ error: "Review not found." }, { status: 404 });
    }

    if (review.document.project.advisorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    return NextResponse.json({
      data: {
        id: review.id,
        feedback: review.feedback,
        feedbackType: review.feedbackType,
        isApproved: review.isApproved,
        updatedAt: review.updatedAt,
      },
    });
  } catch (err) {
    console.error("[reviews/[id]/feedback:GET] Unexpected error:", err);
    return NextResponse.json(
      { error: "Failed to fetch feedback." },
      { status: 500 },
    );
  }
}
