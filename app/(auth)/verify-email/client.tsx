"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, Loader2, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type VerifyState = "loading" | "success" | "error" | "pending";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const email = searchParams.get("email");

  const [state, setState] = useState<VerifyState>(
    token ? "loading" : "pending",
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) return;
    const tokenValue = token;

    let cancelled = false;

    async function verify() {
      try {
        const res = await fetch(
          `/api/auth/verify-email?token=${encodeURIComponent(tokenValue)}`,
        );
        const data = await res.json();

        if (cancelled) return;

        if (res.ok) {
          setState("success");
          setMessage(data.message ?? "Email verified successfully!");
        } else {
          setState("error");
          setMessage(data.error ?? "Verification failed. Please try again.");
        }
      } catch {
        if (!cancelled) {
          setState("error");
          setMessage("An unexpected error occurred. Please try again.");
        }
      }
    }

    verify();

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state === "pending") {
    return (
      <Card className="w-full shadow-md">
        <CardHeader className="space-y-1 pb-4 text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50">
            <Mail className="h-7 w-7 text-indigo-600" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Check your email
          </CardTitle>
          <CardDescription className="text-base">
            We sent a verification link to{" "}
            {email ? (
              <span className="font-semibold text-gray-800">{email}</span>
            ) : (
              "your email address"
            )}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-gray-600">
            Click the link in the email to verify your account. The link will
            expire in <span className="font-medium text-gray-800">24 hours</span>.
          </p>

          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-left">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Didn&apos;t receive it?
            </p>
            <ul className="list-inside list-disc space-y-1 text-xs text-gray-600">
              <li>Check your spam or junk folder</li>
              <li>Make sure you entered the correct email</li>
              <li>Allow a few minutes for the email to arrive</li>
            </ul>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 border-t pt-4">
          <p className="text-sm text-gray-500">
            Already verified?{" "}
            <Link
              href="/login"
              className="font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
            >
              Sign in
            </Link>
          </p>
          <p className="text-sm text-gray-500">
            Wrong email?{" "}
            <Link
              href="/register"
              className="font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
            >
              Register again
            </Link>
          </p>
        </CardFooter>
      </Card>
    );
  }

  if (state === "loading") {
    return (
      <Card className="w-full shadow-md">
        <CardContent className="flex flex-col items-center justify-center gap-4 py-16">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
          <p className="text-sm font-medium text-gray-600">
            Verifying your email address...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (state === "success") {
    return (
      <Card className="w-full shadow-md">
        <CardHeader className="space-y-1 pb-4 text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-gray-900">
            Email verified!
          </CardTitle>
          <CardDescription className="text-base">{message}</CardDescription>
        </CardHeader>

        <CardContent className="text-center">
          <p className="text-sm text-gray-600">
            Your account is now active. You can sign in and start reviewing
            student documents.
          </p>
        </CardContent>

        <CardFooter className="justify-center border-t pt-4">
          <Button
            render={<Link href="/login" />}
            nativeButton={false}
            className="bg-indigo-600 px-8 text-white hover:bg-indigo-700"
          >
            Continue to Sign In
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full shadow-md">
      <CardHeader className="space-y-1 pb-4 text-center">
        <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
          <XCircle className="h-8 w-8 text-red-500" />
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight text-gray-900">
          Verification failed
        </CardTitle>
        <CardDescription className="text-base text-red-600">
          {message}
        </CardDescription>
      </CardHeader>

      <CardContent className="text-center">
        <p className="text-sm text-gray-600">
          The verification link may have expired or already been used. Please
          register again to receive a new link.
        </p>
      </CardContent>

      <CardFooter className="flex flex-wrap justify-center gap-3 border-t pt-4">
        <Button
          render={<Link href="/register" />}
          nativeButton={false}
          variant="outline"
          className="border-indigo-200 text-indigo-600 hover:bg-indigo-50"
        >
          Register again
        </Button>
        <Button
          render={<Link href="/login" />}
          nativeButton={false}
          className="bg-indigo-600 text-white hover:bg-indigo-700"
        >
          Go to Sign In
        </Button>
      </CardFooter>
    </Card>
  );
}

export default VerifyEmailContent;