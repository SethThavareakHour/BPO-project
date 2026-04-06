import type { Metadata } from "next"
import { RegisterForm } from "@/components/auth/register-form"

export const metadata: Metadata = {
  title: "Create Account",
  description: "Create your Technical BPO advisor account",
}

export default function RegisterPage() {
  return <RegisterForm />
}
