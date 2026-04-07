import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get("token")

    // ── 1. Token must be present ──────────────────────────────────────
    if (!token) {
      return NextResponse.json(
        { error: "Verification token is missing." },
        { status: 400 }
      )
    }

    // ── 2. Look up the token ──────────────────────────────────────────
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token },
      include: {
        user: {
          select: { id: true, email: true, name: true, emailVerified: true },
        },
      },
    })

    if (!verificationToken) {
      return NextResponse.json(
        { error: "Invalid verification token. It may have already been used or does not exist." },
        { status: 400 }
      )
    }

    // ── 3. Check token type ───────────────────────────────────────────
    if (verificationToken.type !== "EMAIL_VERIFICATION") {
      return NextResponse.json(
        { error: "Invalid token type." },
        { status: 400 }
      )
    }

    // ── 4. Check if already used ──────────────────────────────────────
    if (verificationToken.used) {
      return NextResponse.json(
        { error: "This verification link has already been used. Please sign in." },
        { status: 400 }
      )
    }

    // ── 5. Check expiry ───────────────────────────────────────────────
    if (new Date() > verificationToken.expiresAt) {
      return NextResponse.json(
        {
          error:
            "This verification link has expired. Please register again to receive a new link.",
        },
        { status: 400 }
      )
    }

    // ── 6. Already verified ───────────────────────────────────────────
    if (verificationToken.user.emailVerified) {
      return NextResponse.json(
        { message: "Your email address is already verified. You can sign in." },
        { status: 200 }
      )
    }

    // ── 7. Mark email as verified + invalidate token (transaction) ────
    await prisma.$transaction([
      prisma.user.update({
        where: { id: verificationToken.userId },
        data: { emailVerified: true },
      }),
      prisma.verificationToken.update({
        where: { id: verificationToken.id },
        data: { used: true },
      }),
    ])

    // ── 8. Success ────────────────────────────────────────────────────
    return NextResponse.json(
      {
        message:
          "Email verified successfully! You can now sign in to your account.",
        email: verificationToken.user.email,
      },
      { status: 200 }
    )
  } catch (err) {
    console.error("[verify-email] Unexpected error:", err)
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    )
  }
}
