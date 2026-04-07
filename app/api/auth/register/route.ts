import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import { sendVerificationEmail } from "@/lib/mailer"

const registerSchema = z.object({
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
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password must be at most 100 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
})

export async function POST(req: NextRequest) {
  try {
    // ── 1. Parse & validate body ──────────────────────────────────────
    const body = await req.json().catch(() => null)

    if (!body) {
      return NextResponse.json(
        { error: "Invalid or missing request body." },
        { status: 400 }
      )
    }

    const parsed = registerSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 422 }
      )
    }

    const { name, email, password } = parsed.data

    // ── 2. Check for existing account ─────────────────────────────────
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, emailVerified: true },
    })

    if (existing) {
      if (!existing.emailVerified) {
        // Account exists but is unverified — resend verification email
        // First, invalidate any existing tokens for this user
        await prisma.verificationToken.updateMany({
          where: {
            userId: existing.id,
            type: "EMAIL_VERIFICATION",
            used: false,
          },
          data: { used: true },
        })

        // Create a fresh token
        const token = await prisma.verificationToken.create({
          data: {
            userId: existing.id,
            type: "EMAIL_VERIFICATION",
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          },
        })

        await sendVerificationEmail(email, name, token.token)

        return NextResponse.json(
          {
            message:
              "A verification email has been resent. Please check your inbox.",
          },
          { status: 200 }
        )
      }

      // Verified account already exists
      return NextResponse.json(
        { error: "An account with this email address already exists." },
        { status: 409 }
      )
    }

    // ── 3. Hash password ──────────────────────────────────────────────
    const hashedPassword = await bcrypt.hash(password, 12)

    // ── 4. Create user + verification token in a transaction ──────────
    const { user, token } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          emailVerified: false,
        },
        select: { id: true, name: true, email: true },
      })

      const token = await tx.verificationToken.create({
        data: {
          userId: user.id,
          type: "EMAIL_VERIFICATION",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
        select: { token: true },
      })

      return { user, token }
    })

    // ── 5. Send verification email ─────────────────────────────────────
    try {
      await sendVerificationEmail(user.email, user.name, token.token)
    } catch (mailError) {
      // Do not roll back the user creation — the user can request a resend.
      // Log the error server-side.
      console.error("[register] Failed to send verification email:", mailError)

      return NextResponse.json(
        {
          message:
            "Account created, but we could not send a verification email. " +
            "Please contact support to verify your account.",
          userId: user.id,
        },
        { status: 201 }
      )
    }

    // ── 6. Success ─────────────────────────────────────────────────────
    return NextResponse.json(
      {
        message:
          "Account created successfully. Please check your email to verify your account before signing in.",
      },
      { status: 201 }
    )
  } catch (err) {
    console.error("[register] Unexpected error:", err)
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    )
  }
}
