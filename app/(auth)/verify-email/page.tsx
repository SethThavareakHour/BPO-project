import { Suspense } from "react";
import type { Metadata } from "next";
import { Loader2 } from "lucide-react";

import VerifyEmailClient from "./client";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Verify Email | Technical BPO",
  description: "Verify your Technical BPO email address",
};

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <Card className="w-full shadow-md">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
            <p className="text-sm font-medium text-gray-600">Loading…</p>
          </CardContent>
        </Card>
      }
    >
      <VerifyEmailClient />
    </Suspense>
  );
}
