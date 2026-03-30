import { google } from "googleapis";
import type { DriveFile } from "@/types";

// ─────────────────────────────────────────────
// Auth — Service Account
// ─────────────────────────────────────────────
function getDriveClient() {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !privateKey) {
    throw new Error(
      "Missing Google Drive credentials. " +
        "Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY in your .env file.",
    );
  }

  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });

  return google.drive({ version: "v3", auth });
}

// ─────────────────────────────────────────────
// List files inside a Drive folder
// ─────────────────────────────────────────────
export async function listFilesInFolder(
  folderId: string,
): Promise<DriveFile[]> {
  const drive = getDriveClient();

  const response = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id, name, mimeType, webViewLink, createdTime, modifiedTime)",
    orderBy: "createdTime desc",
    pageSize: 100,
  });

  const files = response.data.files ?? [];

  return files
    .filter((f) => f.id && f.name && f.mimeType)
    .map((f) => ({
      id: f.id!,
      name: f.name!,
      mimeType: f.mimeType!,
      webViewLink: f.webViewLink ?? null,
      createdTime: f.createdTime ?? null,
      modifiedTime: f.modifiedTime ?? null,
    }));
}

// ─────────────────────────────────────────────
// Download raw file bytes from Drive
// ─────────────────────────────────────────────
async function downloadFileBytes(fileId: string): Promise<Buffer> {
  const drive = getDriveClient();

  const response = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" },
  );

  return Buffer.from(response.data as ArrayBuffer);
}

// ─────────────────────────────────────────────
// Export a Google Doc as plain text
// ─────────────────────────────────────────────
async function exportGoogleDocAsText(fileId: string): Promise<string> {
  const drive = getDriveClient();

  const response = await drive.files.export(
    { fileId, mimeType: "text/plain" },
    { responseType: "arraybuffer" },
  );

  return Buffer.from(response.data as ArrayBuffer).toString("utf-8");
}

// ─────────────────────────────────────────────
// Extract plain text from a PDF buffer
// ─────────────────────────────────────────────
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  // Dynamic import to avoid issues in environments where pdf-parse
  // triggers a test-file read on module load.
  // Handle both CJS (default export) and ESM (named export) builds.
  const mod = await import("pdf-parse");
  const pdfParse =
    typeof mod === "function"
      ? mod
      : ((mod as { default?: unknown }).default ?? mod);
  if (typeof pdfParse !== "function") {
    throw new Error("pdf-parse module did not export a callable function.");
  }
  const result = await (pdfParse as (buf: Buffer) => Promise<{ text: string }>)(
    buffer,
  );
  return result.text ?? "";
}

// ─────────────────────────────────────────────
// Extract plain text from a DOCX buffer
// ─────────────────────────────────────────────
async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value ?? "";
}

// ─────────────────────────────────────────────
// Main: download + extract text from any supported file
// Supported types:
//   - application/pdf
//   - application/vnd.openxmlformats-officedocument.wordprocessingml.document (DOCX)
//   - application/vnd.google-apps.document (Google Docs)
//   - text/plain
// ─────────────────────────────────────────────
export async function extractTextFromFile(
  fileId: string,
  mimeType: string,
): Promise<string> {
  // Google Docs — export as plain text
  if (mimeType === "application/vnd.google-apps.document") {
    return exportGoogleDocAsText(fileId);
  }

  // Plain text
  if (mimeType === "text/plain") {
    const buffer = await downloadFileBytes(fileId);
    return buffer.toString("utf-8");
  }

  // PDF
  if (mimeType === "application/pdf") {
    const buffer = await downloadFileBytes(fileId);
    return extractTextFromPDF(buffer);
  }

  // DOCX
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const buffer = await downloadFileBytes(fileId);
    return extractTextFromDOCX(buffer);
  }

  throw new Error(
    `Unsupported file type: "${mimeType}". ` +
      "Only PDF, DOCX, Google Docs, and plain text files are supported.",
  );
}

// ─────────────────────────────────────────────
// Detect document type from filename
// Returns "SRS", "OPPM", or "UNKNOWN"
// ─────────────────────────────────────────────
export function detectDocumentType(
  filename: string,
): "SRS" | "OPPM" | "UNKNOWN" {
  const upper = filename.toUpperCase();

  if (upper.includes("SRS")) return "SRS";
  if (upper.includes("OPPM")) return "OPPM";

  // Fallback: check common full-name variants
  if (
    upper.includes("SOFTWARE REQUIREMENT") ||
    upper.includes("SYSTEM REQUIREMENT") ||
    upper.includes("REQUIREMENTS SPECIFICATION")
  ) {
    return "SRS";
  }

  if (
    upper.includes("ONE PAGE PROJECT") ||
    upper.includes("ONE-PAGE PROJECT") ||
    upper.includes("PROJECT MANAGER")
  ) {
    return "OPPM";
  }

  return "UNKNOWN";
}

// ─────────────────────────────────────────────
// Check whether a Drive folder ID is accessible
// by the configured service account
// ─────────────────────────────────────────────
export async function validateFolderAccess(folderId: string): Promise<{
  valid: boolean;
  folderName?: string;
  error?: string;
}> {
  try {
    const drive = getDriveClient();
    const response = await drive.files.get({
      fileId: folderId,
      fields: "id, name, mimeType",
    });

    const file = response.data;

    if (file.mimeType !== "application/vnd.google-apps.folder") {
      return {
        valid: false,
        error: "The provided ID is not a Google Drive folder.",
      };
    }

    return { valid: true, folderName: file.name ?? undefined };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";

    return {
      valid: false,
      error: `Cannot access folder: ${message}. Make sure you have shared it with the service account email.`,
    };
  }
}
