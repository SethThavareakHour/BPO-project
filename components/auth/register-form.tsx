"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { z } from "zod"
import { toast } from "sonner"
import { Eye, EyeOff, Loader2, UserPlus } from "lucide-react"

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
const registerSchema = z
  .object({
    name: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name must be at most 100 characters")
      .trim(),
    email: z
      .string()
      .min(1, "Email is required")
      .email("Please enter a valid email address")
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
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

type RegisterFormData = z.infer<typeof registerSchema>
type FieldErrors = Partial<Record<keyof RegisterFormData, string>>

// ─────────────────────────────────────────────
// Password strength indicator
// ─────────────────────────────────────────────
function getPasswordStrength(password: string): {
  score: number
  label: string
  color: string
} {
  if (!password) return { score: 0, label: "", color: "" }

  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password)) score++
  if (/[a-z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  if (score <= 2) return { score, label: "Weak", color: "bg-red-500" }
  if (score <= 4) return { score, label: "Fair", color: "bg-amber-500" }
  return { score, label: "Strong", color: "bg-green-500" }
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export function RegisterForm() {
  const router = useRouter()

  const [formData, setFormData] = useState<RegisterFormData>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const passwordStrength = getPasswordStrength(formData.password)

  // ── Handlers ──────────────────────────────────────────────────────────
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    // Clear the field error as the user types
    if (fieldErrors[name as keyof RegisterFormData]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    // ── Client-side validation ──────────────────────────────────────
    const parsed = registerSchema.safeParse(formData)
    if (!parsed.success) {
      const errors: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof RegisterFormData
        if (!errors[field]) errors[field] = issue.message
      }
      setFieldErrors(errors)
      return
    }

    setIsLoading(true)
    setFieldErrors({})

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: parsed.data.name,
          email: parsed.data.email,
          password: parsed.data.password,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        // Handle field-level validation errors from the server
        if (res.status === 422 && data.details) {
          const serverErrors: FieldErrors = {}
          for (const [field, messages] of Object.entries(data.details)) {
            serverErrors[field as keyof RegisterFormData] = (
              messages as string[]
            )[0]
          }
          setFieldErrors(serverErrors)
          return
        }

        // Handle conflict (email already exists)
        if (res.status === 409) {
          setFieldErrors({ email: data.error })
          return
        }

        toast.error(data.error ?? "Registration failed. Please try again.")
        return
      }

      // ── Success ───────────────────────────────────────────────────
      toast.success(
        data.message ??
          "Account created! Please check your email to verify your account."
      )

      // Redirect to a confirmation page
      router.push(`/verify-email?email=${encodeURIComponent(parsed.data.email)}`)
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
          Create an account
        </CardTitle>
        <CardDescription className="text-gray-400">
          Register as an advisor to start reviewing student documents
        </CardDescription>
      </CardHeader>

      <CardContent className="px-8">
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Full Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="Dr. Jane Smith"
              value={formData.name}
              onChange={handleChange}
              disabled={isLoading}
              aria-invalid={!!fieldErrors.name}
              aria-describedby={fieldErrors.name ? "name-error" : undefined}
              className={`rounded-xl ${
                fieldErrors.name
                  ? "border-red-400 focus-visible:ring-red-400"
                  : ""
              }`}
            />
            {fieldErrors.name && (
              <p id="name-error" className="text-xs text-red-600">
                {fieldErrors.name}
              </p>
            )}
          </div>

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
              className={`rounded-xl ${
                fieldErrors.email
                  ? "border-red-400 focus-visible:ring-red-400"
                  : ""
              }`}
            />
            {fieldErrors.email && (
              <p id="email-error" className="text-xs text-red-600">
                {fieldErrors.email}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                disabled={isLoading}
                aria-invalid={!!fieldErrors.password}
                aria-describedby={
                  fieldErrors.password ? "password-error" : undefined
                }
                className={`rounded-xl ${
                  fieldErrors.password
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

            {/* Password strength bar */}
            {formData.password && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        i <= passwordStrength.score
                          ? passwordStrength.color
                          : "bg-gray-200"
                      }`}
                    />
                  ))}
                </div>
                <p
                  className={`text-xs ${
                    passwordStrength.label === "Strong"
                      ? "text-green-600"
                      : passwordStrength.label === "Fair"
                      ? "text-amber-600"
                      : "text-red-600"
                  }`}
                >
                  Password strength: {passwordStrength.label}
                </p>
              </div>
            )}

            {fieldErrors.password && (
              <p id="password-error" className="text-xs text-red-600">
                {fieldErrors.password}
              </p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={handleChange}
                disabled={isLoading}
                aria-invalid={!!fieldErrors.confirmPassword}
                aria-describedby={
                  fieldErrors.confirmPassword
                    ? "confirm-password-error"
                    : undefined
                }
                className={`rounded-xl ${
                  fieldErrors.confirmPassword
                    ? "border-red-400 pr-10 focus-visible:ring-red-400"
                    : "pr-10"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                disabled={isLoading}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 focus:outline-none transition-colors"
                aria-label={
                  showConfirmPassword
                    ? "Hide confirm password"
                    : "Show confirm password"
                }
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {fieldErrors.confirmPassword && (
              <p id="confirm-password-error" className="text-xs text-red-600">
                {fieldErrors.confirmPassword}
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
                Creating account…
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Create account
              </>
            )}
          </Button>

          {/* Terms note */}
          <p className="text-center text-xs text-gray-500">
            By creating an account, you agree to our{" "}
            <span className="font-medium text-gray-700">Terms of Service</span>{" "}
            and{" "}
            <span className="font-medium text-gray-700">Privacy Policy</span>.
          </p>
        </form>
      </CardContent>

      <CardFooter className="flex justify-center border-t border-gray-50 pt-5 pb-6 mx-8">
        <p className="text-sm text-gray-400">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
