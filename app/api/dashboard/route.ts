import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { DashboardStats } from "@/types";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
    }

    const advisorId = session.user.id;

    // ── Run all counts in parallel ────────────────────────────────────────
    const [
      totalProjects,
      totalStudents,
      pendingReviews,
      approvedDocuments,
      recentReviews,
    ] = await Promise.all([
      // Total projects owned by this advisor
      prisma.project.count({
        where: { advisorId },
      }),

      // Total students across all advisor projects
      prisma.student.count({
        where: {
          project: { advisorId },
        },
      }),

      // Documents that have been reviewed but not yet approved
      prisma.document.count({
        where: {
          project: { advisorId },
          status: { in: ["PENDING", "REVIEWING", "REVIEWED"] },
        },
      }),

      // Documents that have been approved
      prisma.document.count({
        where: {
          project: { advisorId },
          status: "APPROVED",
        },
      }),

      // 5 most recent reviews for this advisor's projects
      prisma.review.findMany({
        where: {
          document: {
            project: { advisorId },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          isApproved: true,
          createdAt: true,
          document: {
            select: {
              name: true,
              type: true,
              project: {
                select: { name: true },
              },
            },
          },
        },
      }),
    ]);

    const stats: DashboardStats = {
      totalProjects,
      totalStudents,
      pendingReviews,
      approvedDocuments,
      recentReviews: recentReviews.map((r: any) => ({
        id: r.id,
        documentName: r.document.name,
        documentType: r.document.type,
        projectName: r.document.project.name,
        isApproved: r.isApproved,
        createdAt: r.createdAt,
      })),
    };

    return NextResponse.json({ data: stats });
  } catch (err) {
    console.error("[dashboard] Unexpected error:", err);
    return NextResponse.json(
      { error: "Failed to load dashboard statistics." },
      { status: 500 },
    );
  }
}
