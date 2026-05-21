import { google } from "googleapis";
import {
  ReviewProviderUnavailableError,
  isReviewProviderConfigured,
  ocrImageWithDeepSeek,
} from "@/lib/ai";
import type { DriveFile } from "@/types";

const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";
const GOOGLE_SHEET_MIME = "application/vnd.google-apps.spreadsheet";
const GOOGLE_SLIDE_MIME = "application/vnd.google-apps.presentation";
const PDF_MIME = "application/pdf";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const XLS_MIME = "application/vnd.ms-excel";
const PPTX_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export type ExtractedFileText = {
  text: string;
  method:
    | "GOOGLE_EXPORT"
    | "PDF_TEXT"
    | "DOCX"
    | "XLSX"
    | "CSV"
    | "TEXT"
    | "DEEPSEEK_OCR";
};

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
    scopes: ["https://www.googleapis.com/auth/drive"],
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
// List every file visible to the service account.
// Useful for diagnostics and future project-free import flows.
// ─────────────────────────────────────────────
export async function listAllAccessibleFiles(): Promise<DriveFile[]> {
  const drive = getDriveClient();
  const allFiles: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const response = await drive.files.list({
      pageSize: 100,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      fields:
        "nextPageToken, files(id, name, mimeType, webViewLink, createdTime, modifiedTime)",
      pageToken,
    });

    const files = response.data.files ?? [];
    allFiles.push(
      ...files
        .filter((f) => f.id && f.name && f.mimeType)
        .map((f) => ({
          id: f.id!,
          name: f.name!,
          mimeType: f.mimeType!,
          webViewLink: f.webViewLink ?? null,
          createdTime: f.createdTime ?? null,
          modifiedTime: f.modifiedTime ?? null,
        })),
    );

    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return allFiles;
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
async function exportGoogleFileAsText(fileId: string, mimeType: string): Promise<string> {
  const drive = getDriveClient();
  const exportMimeType =
    mimeType === GOOGLE_SHEET_MIME ? "text/csv" : "text/plain";

  const response = await drive.files.export(
    { fileId, mimeType: exportMimeType },
    { responseType: "arraybuffer" },
  );

  return Buffer.from(response.data as ArrayBuffer).toString("utf-8");
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function looksLikeOppm(filename?: string, text?: string): boolean {
  const source = `${filename ?? ""}\n${text ?? ""}`.toUpperCase();
  return (
    source.includes("OPPM") ||
    source.includes("ONE PAGE PROJECT") ||
    source.includes("ONE-PAGE PROJECT") ||
    source.includes("MAJOR TASKS")
  );
}

function formatOppmLikeText(text: string): string {
  const statusMap: Record<string, string> = {
    "◻": "Not Started",
    "□": "Not Started",
    "⚫": "In Progress",
    "●": "In Progress",
    "◼": "Complete",
    "■": "Complete",
  };

  const lines = normalizeWhitespace(text)
    .split("\n")
    .map((line) => {
      let formatted = line.replace(/\s{2,}/g, " | ").trim();

      for (const [symbol, label] of Object.entries(statusMap)) {
        formatted = formatted.replaceAll(symbol, label);
      }

      return formatted;
    })
    .filter(Boolean);

  if (lines.length === 0) return "";

  return [
    "[OPPM structured text]",
    "Table columns are separated with | where extraction preserved spacing.",
    "",
    ...lines,
  ].join("\n");
}

// ─────────────────────────────────────────────
// Extract plain text from a PDF buffer
// ─────────────────────────────────────────────
async function extractTextFromPDF(
  buffer: Buffer,
  filename?: string,
): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();
  const text = result.text ?? "";
  return looksLikeOppm(filename, text) ? formatOppmLikeText(text) : normalizeWhitespace(text);
}

// ─────────────────────────────────────────────
// Extract plain text from a DOCX buffer
// ─────────────────────────────────────────────
async function extractTextFromDOCX(buffer: Buffer, filename?: string): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value ?? "";
  return looksLikeOppm(filename, text) ? formatOppmLikeText(text) : normalizeWhitespace(text);
}

// ─────────────────────────────────────────────
// Extract text/CSV from an Excel buffer
// ─────────────────────────────────────────────
async function extractTextFromExcel(buffer: Buffer, filename?: string): Promise<string> {
  const xlsx = await import("xlsx");
  const workbook = xlsx.read(buffer, { type: "buffer" });
  let fullText = "";

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    // Convert to CSV as it preserves structure better than raw text for AI
    const csv = xlsx.utils.sheet_to_csv(sheet);
    fullText += `--- Sheet: ${sheetName} ---\n${csv}\n\n`;
  }
  return looksLikeOppm(filename, fullText)
    ? formatOppmLikeText(fullText)
    : normalizeWhitespace(fullText);
}

async function extractTextFromPresentation(buffer: Buffer): Promise<string> {
  return normalizeWhitespace(buffer.toString("utf-8"));
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
  filename?: string,
): Promise<string> {
  const result = await extractTextFromFileWithMethod(fileId, mimeType, filename);
  return result.text;
}

export async function extractTextFromFileWithMethod(
  fileId: string,
  mimeType: string,
  filename?: string,
): Promise<ExtractedFileText> {
  // Google Workspace files — export to text or CSV.
  if (
    mimeType === GOOGLE_DOC_MIME ||
    mimeType === GOOGLE_SHEET_MIME ||
    mimeType === GOOGLE_SLIDE_MIME
  ) {
    const text = await exportGoogleFileAsText(fileId, mimeType);
    return {
      text: looksLikeOppm(filename, text)
        ? formatOppmLikeText(text)
        : normalizeWhitespace(text),
      method: "GOOGLE_EXPORT",
    };
  }

  // Plain text / CSV.
  if (mimeType === "text/plain" || mimeType === "text/csv") {
    const buffer = await downloadFileBytes(fileId);
    const text = buffer.toString("utf-8");
    return {
      text: looksLikeOppm(filename, text)
        ? formatOppmLikeText(text)
        : normalizeWhitespace(text),
      method: mimeType === "text/csv" ? "CSV" : "TEXT",
    };
  }

  if (mimeType === PDF_MIME) {
    const buffer = await downloadFileBytes(fileId);
    const text = await extractTextFromPDF(buffer, filename);
    if (text.trim().length >= 50) {
      return { text, method: "PDF_TEXT" };
    }

    if (!isReviewProviderConfigured()) {
      throw new Error(
        "PDF text extraction found too little readable text, and DeepSeek OCR is not configured.",
      );
    }

    const ocrText = await ocrImageWithDeepSeek(buffer, PDF_MIME);
    return {
      text: looksLikeOppm(filename, ocrText)
        ? formatOppmLikeText(ocrText)
        : normalizeWhitespace(ocrText),
      method: "DEEPSEEK_OCR",
    };
  }

  if (mimeType === DOCX_MIME) {
    const buffer = await downloadFileBytes(fileId);
    return { text: await extractTextFromDOCX(buffer, filename), method: "DOCX" };
  }

  if (mimeType === XLSX_MIME || mimeType === XLS_MIME) {
    const buffer = await downloadFileBytes(fileId);
    return { text: await extractTextFromExcel(buffer, filename), method: "XLSX" };
  }

  if (mimeType === PPTX_MIME) {
    const buffer = await downloadFileBytes(fileId);
    return {
      text: await extractTextFromPresentation(buffer),
      method: "TEXT",
    };
  }

  if (IMAGE_MIME_TYPES.has(mimeType)) {
    if (!isReviewProviderConfigured()) {
      throw new ReviewProviderUnavailableError();
    }

    const buffer = await downloadFileBytes(fileId);
    const text = await ocrImageWithDeepSeek(buffer, mimeType);
    return {
      text: looksLikeOppm(filename, text)
        ? formatOppmLikeText(text)
        : normalizeWhitespace(text),
      method: "DEEPSEEK_OCR",
    };
  }

  throw new Error(
    `Unsupported file type: "${mimeType}". ` +
    "Supported: PDF, Word, Excel, CSV, Google Docs, and Google Sheets.",
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

  if (/\bSRS\b/.test(upper)) return "SRS";
  if (/\bOPPM\b/.test(upper)) return "OPPM";

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

export function isReviewCandidateName(filename: string): boolean {
  return detectDocumentType(filename) !== "UNKNOWN";
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

// ─────────────────────────────────────────────
// Create a new folder and share it with a user
// ─────────────────────────────────────────────
export async function createDriveFolder(
  folderName: string,
  shareWithEmails: string[] = [],
): Promise<string> {
  const drive = getDriveClient();

  // 1. Create the folder in the Service Account's drive
  const response = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
    },
    fields: "id",
  });

  const folderId = response.data.id;
  if (!folderId) {
    throw new Error("Failed to create Google Drive folder");
  }

  // 2. Share with the users as Editors so they can view and upload
  for (const email of shareWithEmails) {
    if (!email) continue;
    try {
      await drive.permissions.create({
        fileId: folderId,
        requestBody: {
          role: "writer",
          type: "user",
          emailAddress: email,
        },
        // We set this to true so users get an email
        // and the folder shows up in their "Shared with me" section
        sendNotificationEmail: true,
      });
    } catch (err) {
      console.error(`Failed to share folder with ${email}`, err);
    }
  }

  return folderId;
}

// ─────────────────────────────────────────────
// Delete a Google Drive folder
// ─────────────────────────────────────────────
export async function deleteDriveFolder(folderId: string): Promise<void> {
  const drive = getDriveClient();
  try {
    // We 'trash' the folder instead of absolute delete for safety
    await drive.files.update({
      fileId: folderId,
      requestBody: {
        trashed: true,
      },
    });
  } catch (err) {
    console.error(`Failed to delete Drive folder ${folderId}:`, err);
    // We don't throw here to avoid failing the whole project deletion
    // if the Drive folder was already manually deleted or moved.
  }
}

// ─────────────────────────────────────────────
// Rename a Google Drive folder
// ─────────────────────────────────────────────
export async function renameDriveFolder(folderId: string, newFolderName: string): Promise<void> {
  const drive = getDriveClient();
  try {
    await drive.files.update({
      fileId: folderId,
      requestBody: {
        name: newFolderName,
      },
    });
  } catch (err) {
    console.error(`Failed to rename Drive folder ${folderId}:`, err);
  }
}
