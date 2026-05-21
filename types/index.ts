import type {
  DocumentType,
  DocStatus,
  DriveSyncStatus,
  ExtractionMethod,
  ExtractionStatus,
  FeedbackType,
  ScanEventType,
  TokenType,
} from "@/lib/generated/prisma/client";

// ─────────────────────────────────────────────
// Re-export Prisma enums for convenience
// ─────────────────────────────────────────────
export type {
  DocumentType,
  DocStatus,
  DriveSyncStatus,
  ExtractionMethod,
  ExtractionStatus,
  FeedbackType,
  ScanEventType,
  TokenType,
};

// ─────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────
export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
}

// ─────────────────────────────────────────────
// Project
// ─────────────────────────────────────────────
export interface ProjectWithCounts {
  id: string;
  name: string;
  description: string | null;
  driveFolderId: string | null;
  advisorId: string;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    students: number;
    documents: number;
  };
}

export interface ProjectWithDetails {
  id: string;
  name: string;
  description: string | null;
  driveFolderId: string | null;
  advisorId: string;
  createdAt: Date;
  updatedAt: Date;
  students: StudentRow[];
  documents: DocumentWithReview[];
}

export interface CreateProjectPayload {
  name: string;
  description?: string;
  driveFolderId?: string;
}

export interface UpdateProjectPayload {
  name?: string;
  description?: string;
  driveFolderId?: string;
}

// ─────────────────────────────────────────────
// Student
// ─────────────────────────────────────────────
export interface StudentRow {
  id: string;
  name: string;
  email: string;
  studentId: string | null;
  projectId: string;
  createdAt: Date;
}

export interface CreateStudentPayload {
  name: string;
  email: string;
  studentId?: string;
}

// ─────────────────────────────────────────────
// Document
// ─────────────────────────────────────────────
export interface DocumentWithReview {
  id: string;
  name: string;
  type: DocumentType;
  driveFileId: string;
  mimeType: string | null;
  driveUrl: string | null;
  status: DocStatus;
  driveCreatedTime: Date | null;
  driveModifiedTime: Date | null;
  driveLastSeenAt: Date | null;
  driveLastSyncedAt: Date | null;
  driveSyncStatus: DriveSyncStatus;
  needsReview: boolean;
  reviewCount: number;
  lastReviewedAt: Date | null;
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
  extraction: DocumentExtractionSummary | null;
  scanEvents?: DocumentScanEventSummary[];
  review: ReviewSummary | null;
}

export interface DocumentExtractionSummary {
  id: string;
  status: ExtractionStatus;
  method: ExtractionMethod;
  error: string | null;
  sourceModifiedTime: Date | null;
  extractedAt: Date | null;
}

export interface DocumentScanEventSummary {
  id: string;
  eventType: ScanEventType;
  driveModifiedTime: Date | null;
  message: string | null;
  createdAt: Date;
}

// ─────────────────────────────────────────────
// Review
// ─────────────────────────────────────────────
export interface ReviewSummary {
  id: string;
  isApproved: boolean;
  approvedAt: Date | null;
  feedbackType: FeedbackType | null;
  feedback: string | null;
  createdAt: Date;
}

export interface ReviewWithDocument {
  id: string;
  documentId: string;
  aiReport: AIReport;
  feedback: string | null;
  feedbackType: FeedbackType | null;
  isApproved: boolean;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  document: DocumentWithReview & {
    project: {
      id: string;
      name: string;
    };
  };
}

export interface AddFeedbackPayload {
  feedback: string;
  feedbackType: FeedbackType;
}

// ─────────────────────────────────────────────
// AI Report Structure
// ─────────────────────────────────────────────
export type IssueSeverity = "HIGH" | "MEDIUM" | "LOW";

export interface FlaggedIssue {
  severity: IssueSeverity;
  section: string;
  issue: string;
  suggestion: string;
}

export interface ReviewCategory {
  score: number; // 0–100
  status: "PASS" | "PARTIAL" | "FAIL";
  summary: string;
  issues: string[];
  suggestions: string[];
}

export interface AIReport {
  overallScore: number; // 0–100
  documentType: "SRS" | "OPPM";
  completeness: ReviewCategory;
  clarity: ReviewCategory;
  feasibility: ReviewCategory;
  missingSections: string[];
  flaggedIssues: FlaggedIssue[];
  summary: string;
  generatedAt: string; // ISO date string
}

// ─────────────────────────────────────────────
// Google Drive
// ─────────────────────────────────────────────
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string | null;
  createdTime: string | null;
  modifiedTime: string | null;
}

export interface DriveScanResult {
  newFiles: DocumentWithReview[];
  modifiedFiles: DocumentWithReview[];
  unchangedFiles: DocumentWithReview[];
  skippedFiles: Array<{
    id: string;
    name: string;
    mimeType: string;
    reason: string;
  }>;
  totalScanned: number;
  totalCandidates: number;
  projectId: string;
  folderId: string;
  summary: {
    imported: number;
    modified: number;
    unchanged: number;
    extracted: number;
    reviewed: number;
    failed: number;
    skipped: number;
    approvedIgnored: number;
  };
  message: string;
}

// ─────────────────────────────────────────────
// Dashboard Stats
// ─────────────────────────────────────────────
export interface DashboardStats {
  totalProjects: number;
  totalStudents: number;
  pendingReviews: number;
  approvedDocuments: number;
  recentReviews: RecentReviewItem[];
}

export interface RecentReviewItem {
  id: string;
  documentName: string;
  documentType: DocumentType;
  projectName: string;
  isApproved: boolean;
  createdAt: Date;
}

// ─────────────────────────────────────────────
// API Response Helpers
// ─────────────────────────────────────────────
export interface ApiSuccess<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  error: string;
  details?: unknown;
}
