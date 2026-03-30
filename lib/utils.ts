import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// ─────────────────────────────────────────────
// shadcn/ui required helper
// ─────────────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─────────────────────────────────────────────
// Date formatting
// ─────────────────────────────────────────────
export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function timeAgo(date: Date | string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);

  const intervals: [number, string][] = [
    [31536000, "year"],
    [2592000, "month"],
    [604800, "week"],
    [86400, "day"],
    [3600, "hour"],
    [60, "minute"],
  ];

  for (const [secs, label] of intervals) {
    const count = Math.floor(seconds / secs);
    if (count >= 1) {
      return `${count} ${label}${count !== 1 ? "s" : ""} ago`;
    }
  }

  return "just now";
}

// ─────────────────────────────────────────────
// Score → colour helpers (for AI report badges)
// ─────────────────────────────────────────────
export function scoreToColor(score: number): string {
  if (score >= 75) return "text-green-600";
  if (score >= 40) return "text-amber-600";
  return "text-red-600";
}

export function scoreToBgColor(score: number): string {
  if (score >= 75) return "bg-green-50 text-green-700 border-green-200";
  if (score >= 40) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-red-50 text-red-700 border-red-200";
}

export function statusToColor(status: "PASS" | "PARTIAL" | "FAIL"): string {
  switch (status) {
    case "PASS":
      return "bg-green-50 text-green-700 border-green-200";
    case "PARTIAL":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "FAIL":
      return "bg-red-50 text-red-700 border-red-200";
  }
}

export function severityToColor(severity: "HIGH" | "MEDIUM" | "LOW"): string {
  switch (severity) {
    case "HIGH":
      return "bg-red-50 text-red-700 border-red-200";
    case "MEDIUM":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "LOW":
      return "bg-blue-50 text-blue-700 border-blue-200";
  }
}

// ─────────────────────────────────────────────
// Document status helpers
// ─────────────────────────────────────────────
export function docStatusToColor(status: string): string {
  switch (status) {
    case "APPROVED":
      return "bg-green-50 text-green-700 border-green-200";
    case "REVIEWED":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "REVIEWING":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "PENDING":
    default:
      return "bg-gray-50 text-gray-600 border-gray-200";
  }
}

export function docStatusLabel(status: string): string {
  switch (status) {
    case "APPROVED":
      return "Approved";
    case "REVIEWED":
      return "Reviewed";
    case "REVIEWING":
      return "Reviewing";
    case "PENDING":
    default:
      return "Pending";
  }
}

// ─────────────────────────────────────────────
// String helpers
// ─────────────────────────────────────────────
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// ─────────────────────────────────────────────
// MIME type helpers
// ─────────────────────────────────────────────
export function mimeTypeToLabel(mimeType: string): string {
  switch (mimeType) {
    case "application/pdf":
      return "PDF";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return "DOCX";
    case "application/vnd.google-apps.document":
      return "Google Doc";
    case "text/plain":
      return "Text";
    default:
      return mimeType.split("/").pop()?.toUpperCase() ?? "File";
  }
}

export function isSupportedMimeType(mimeType: string): boolean {
  const supported = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.google-apps.document",
    "text/plain",
  ];
  return supported.includes(mimeType);
}

// ─────────────────────────────────────────────
// API helpers
// ─────────────────────────────────────────────
export function getBaseUrl(): string {
  if (typeof window !== "undefined") return "";
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  return "http://localhost:3000";
}

export async function fetcher<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}
