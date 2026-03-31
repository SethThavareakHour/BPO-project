"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { signIn } from "next-auth/react"
import { z } from "zod"
import { toast } from "sonner"
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

// ─────────────────────────────────────────────
// Validation schema
// ─────────────────────────────────────────────
const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(6, "Password must be at least 6 characters"),
})

type LoginFormData = z.infer<typeof loginSchema>
type FieldErrors = Partial<Record<keyof LoginFormData, string>>

// ─────────────────────────────────────────────
// NextAuth error messages
// ─────────────────────────────────────────────
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin:
    "Invalid email or password. Please check your credentials and try again.",
  EmailNotVerified:
    "Your email address has not been verified. Please check your inbox for the verification link.",
  Default: "An error occurred during sign in. Please try again.",
}

function getAuthErrorMessage(error: string | null): string | null {
  if (!error) return null
  return AUTH_ERROR_MESSAGES[error] ?? AUTH_ERROR_MESSAGES.Default
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard"
  const urlError = searchParams.get("error")

  const [formData, setFormData] = useState<LoginFormData>({
    email: "",
    password: "",
  })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Show error from URL (e.g. redirected from middleware with ?error=...)
  const urlErrorMessage = getAuthErrorMessage(urlError)

  // ── Handlers ──────────────────────────────────────────────────────────
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    // Clear the field error as the user types
    if (fieldErrors[name as keyof LoginFormData]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    // ── Client-side validation ──────────────────────────────────────
    const parsed = loginSchema.safeParse(formData)
    if (!parsed.success) {
      const errors: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof LoginFormData
        if (!errors[field]) errors[field] = issue.message
      }
      setFieldErrors(errors)
      return
    }

    setIsLoading(true)
    setFieldErrors({})

    try {
      const result = await signIn("credentials", {
        email: parsed.data.email,
        password: parsed.data.password,
        redirect: false,
      })

      if (result?.error) {
        const message = getAuthErrorMessage(result.error)
        toast.error(message ?? AUTH_ERROR_MESSAGES.Default)
        return
      }

      if (result?.ok) {
        toast.success("Signed in successfully! Redirecting…")
        router.push(callbackUrl)
        router.refresh()
      }
    } catch {
      toast.error("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <Card className="w-full border-0 shadow-lg rounded-2xl bg-white">
      <CardHeader className="space-y-1 pb-4 px-8 pt-8">
        <CardTitle className="text-2xl font-bold tracking-tight text-gray-900">
          Sign in
        </CardTitle>
        <CardDescription className="text-gray-400">
          Enter your advisor account credentials to continue
        </CardDescription>
      </CardHeader>

      <CardContent className="px-8">
        {/* URL-level error (e.g. unverified email from NextAuth) */}
        {urlErrorMessage && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {urlErrorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              disabled={isLoading}
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? "email-error" : undefined}
              className={`rounded-xl ${fieldErrors.email ? "border-red-400 focus-visible:ring-red-400" : ""}`}
            />
            {fieldErrors.email && (
              <p id="email-error" className="text-xs text-red-600">
                {fieldErrors.email}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
                tabIndex={isLoading ? -1 : 0}
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                disabled={isLoading}
                aria-invalid={!!fieldErrors.password}
                aria-describedby={
                  fieldErrors.password ? "password-error" : undefined
                }
                className={`rounded-xl ${fieldErrors.password
                    ? "border-red-400 pr-10 focus-visible:ring-red-400"
                    : "pr-10"
                  }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                disabled={isLoading}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 focus:outline-none transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {fieldErrors.password && (
              <p id="password-error" className="text-xs text-red-600">
                {fieldErrors.password}
              </p>
            )}
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gray-900 hover:bg-gray-800 text-white rounded-xl h-11"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in…
              </>
            ) : (
              <>
                <LogIn className="mr-2 h-4 w-4" />
                Sign in
              </>
            )}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="flex justify-center border-t border-gray-50 pt-5 pb-6 mx-8">
        <p className="text-sm text-gray-400">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
          >
            Create one
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
