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
// Extract text/CSV from an Excel buffer
// ─────────────────────────────────────────────
async function extractTextFromExcel(buffer: Buffer): Promise<string> {
  const xlsx = await import("xlsx");
  const workbook = xlsx.read(buffer, { type: "buffer" });
  let fullText = "";

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    // Convert to CSV as it preserves structure better than raw text for AI
    const csv = xlsx.utils.sheet_to_csv(sheet);
    fullText += `--- Sheet: ${sheetName} ---\n${csv}\n\n`;
  }
  return fullText;
}

// ─────────────────────────────────────────────
// Export a Google Sheet as CSV
// ─────────────────────────────────────────────
async function exportGoogleSheetAsCSV(fileId: string): Promise<string> {
  const drive = getDriveClient();
  const response = await drive.files.export(
    { fileId, mimeType: "text/csv" },
    { responseType: "arraybuffer" },
  );
  return Buffer.from(response.data as ArrayBuffer).toString("utf-8");
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

  // Google Sheets — export as CSV
  if (mimeType === "application/vnd.google-apps.spreadsheet") {
    return exportGoogleSheetAsCSV(fileId);
  }

  // Plain text / CSV
  if (mimeType === "text/plain" || mimeType === "text/csv") {
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

  // Excel (XLSX / XLS)
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel"
  ) {
    const buffer = await downloadFileBytes(fileId);
    return extractTextFromExcel(buffer);
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
