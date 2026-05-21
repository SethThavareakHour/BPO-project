"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { z } from "zod";
import {
  ArrowLeft,
  Users,
  FileText,
  FolderSync,
  Plus,
  Trash2,
  Loader2,
  ExternalLink,
  FileSearch,
  CheckCircle2,
  Clock,
  AlertCircle,
  Pencil,
  RefreshCw,
  Eye,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  cn,
  formatDate,
  formatDateTime,
  docStatusLabel,
  docStatusToColor,
  extractionStatusLabel,
  extractionStatusToColor,
  mimeTypeToLabel,
  fetcher,
} from "@/lib/utils";
import type { ApiSuccess, DriveScanResult } from "@/types";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface Student {
  id: string;
  name: string;
  email: string;
  studentId: string | null;
  projectId: string;
  createdAt: string;
}

interface ReviewSummary {
  id: string;
  isApproved: boolean;
  approvedAt: string | null;
  feedbackType: string | null;
  feedback: string | null;
  createdAt: string;
}

interface DocumentExtractionSummary {
  id: string;
  status: "PENDING" | "EXTRACTED" | "FAILED";
  method:
    | "GOOGLE_EXPORT"
    | "PDF_TEXT"
    | "DOCX"
    | "XLSX"
    | "CSV"
    | "TEXT"
    | "DEEPSEEK_OCR"
    | "UNSUPPORTED";
  error: string | null;
  sourceModifiedTime: string | null;
  extractedAt: string | null;
}

interface Document {
  id: string;
  name: string;
  type: "SRS" | "OPPM" | "UNKNOWN";
  driveFileId: string;
  mimeType: string | null;
  driveUrl: string | null;
  status: "PENDING" | "REVIEWING" | "REVIEWED" | "APPROVED";
  driveCreatedTime: string | null;
  driveModifiedTime: string | null;
  driveLastSeenAt: string | null;
  driveLastSyncedAt: string | null;
  driveSyncStatus: "NEW" | "MODIFIED" | "SYNCED";
  needsReview: boolean;
  reviewCount: number;
  lastReviewedAt: string | null;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  extraction: DocumentExtractionSummary | null;
  review: ReviewSummary | null;
}

interface ProjectDetail {
  id: string;
  name: string;
  description: string | null;
  driveFolderId: string | null;
  advisorId: string;
  createdAt: string;
  updatedAt: string;
  students: Student[];
  documents: Document[];
}

// ─────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────
const studentSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100).trim(),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email address")
    .toLowerCase()
    .trim(),
  studentId: z.string().max(50).trim().optional(),
});

const projectEditSchema = z.object({
  name: z
    .string()
    .min(2, "Project name must be at least 2 characters")
    .max(150)
    .trim(),
  description: z.string().max(500).trim().optional(),
  driveFolderId: z.string().trim().optional(),
});

type StudentFormData = z.infer<typeof studentSchema>;
type ProjectEditFormData = z.infer<typeof projectEditSchema>;
type FieldErrors<T> = Partial<Record<keyof T, string>>;

// ─────────────────────────────────────────────
// Document type badge
// ─────────────────────────────────────────────
function DocTypeBadge({ type }: { type: Document["type"] }) {
  if (type === "SRS") {
    return (
      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-indigo-100 text-indigo-700">
        SRS
      </span>
    );
  }
  if (type === "OPPM") {
    return (
      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-violet-100 text-violet-700">
        OPPM
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-gray-100 text-gray-500">
      UNKNOWN
    </span>
  );
}

// ─────────────────────────────────────────────
// Document status badge
// ─────────────────────────────────────────────
function DocStatusBadge({ status }: { status: Document["status"] }) {
  const icon =
    status === "APPROVED" ? (
      <CheckCircle2 className="h-3 w-3" />
    ) : status === "REVIEWED" ? (
      <FileSearch className="h-3 w-3" />
    ) : status === "REVIEWING" ? (
      <Loader2 className="h-3 w-3 animate-spin" />
    ) : (
      <Clock className="h-3 w-3" />
    );

  return (
    <Badge
      variant="outline"
      className={cn("gap-1 text-[11px]", docStatusToColor(status))}
    >
      {icon}
      {docStatusLabel(status)}
    </Badge>
  );
}

function DriveSyncBadge({ doc }: { doc: Document }) {
  if (doc.driveSyncStatus === "NEW") {
    return (
      <Badge
        variant="outline"
        className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[11px]"
      >
        New in Drive
      </Badge>
    );
  }

  if (doc.driveSyncStatus === "MODIFIED") {
    return (
      <Badge
        variant="outline"
        className="border-amber-200 bg-amber-50 text-amber-700 text-[11px]"
      >
        Updated in Drive
      </Badge>
    );
  }

  if (doc.needsReview) {
    return (
      <Badge
        variant="outline"
        className="border-blue-200 bg-blue-50 text-blue-700 text-[11px]"
      >
        Needs review
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="border-gray-200 bg-gray-50 text-gray-500 text-[11px]"
    >
      Synced
    </Badge>
  );
}

function ExtractionBadge({ extraction }: { extraction: Document["extraction"] }) {
  const status = extraction?.status ?? null;
  const label = extraction
    ? `${extractionStatusLabel(status)}${
        extraction.status === "EXTRACTED" ? ` (${extraction.method})` : ""
      }`
    : extractionStatusLabel(null);

  return (
    <Badge
      variant="outline"
      className={cn("gap-1 text-[11px]", extractionStatusToColor(status))}
      title={extraction?.error ?? label}
    >
      {status === "EXTRACTED" ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : status === "FAILED" ? (
        <AlertCircle className="h-3 w-3" />
      ) : (
        <Clock className="h-3 w-3" />
      )}
      {label}
    </Badge>
  );
}

// ─────────────────────────────────────────────
// Add Student Dialog
// ─────────────────────────────────────────────
function AddStudentDialog({
  open,
  onOpenChange,
  projectId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState<StudentFormData>({
    name: "",
    email: "",
    studentId: "",
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<StudentFormData>>(
    {},
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setFormData({ name: "", email: "", studentId: "" });
      setFieldErrors({});
    }
  }, [open]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name as keyof StudentFormData]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const parsed = studentSchema.safeParse(formData);
    if (!parsed.success) {
      const errors: FieldErrors<StudentFormData> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof StudentFormData;
        if (!errors[field]) errors[field] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: parsed.data.name,
          email: parsed.data.email,
          studentId: parsed.data.studentId || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 422 && data.details) {
          const serverErrors: FieldErrors<StudentFormData> = {};
          for (const [field, messages] of Object.entries(data.details)) {
            serverErrors[field as keyof StudentFormData] = (
              messages as string[]
            )[0];
          }
          setFieldErrors(serverErrors);
          return;
        }
        if (res.status === 409) {
          setFieldErrors({ email: data.error });
          return;
        }
        toast.error(data.error ?? "Failed to add student.");
        return;
      }

      toast.success("Student added successfully.");
      onOpenChange(false);
      onSuccess();
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Add student</DialogTitle>
          <DialogDescription>
            Add a student to this project. They will be notified by email when
            their documents are reviewed or approved.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="s-name">
              Full name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="s-name"
              name="name"
              placeholder="e.g. Ahmad bin Ali"
              value={formData.name}
              onChange={handleChange}
              disabled={isLoading}
              className={cn(
                fieldErrors.name && "border-red-400 focus-visible:ring-red-400",
              )}
            />
            {fieldErrors.name && (
              <p className="text-xs text-red-600">{fieldErrors.name}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="s-email">
              Email address <span className="text-red-500">*</span>
            </Label>
            <Input
              id="s-email"
              name="email"
              type="email"
              placeholder="student@example.com"
              value={formData.email}
              onChange={handleChange}
              disabled={isLoading}
              className={cn(
                fieldErrors.email &&
                  "border-red-400 focus-visible:ring-red-400",
              )}
            />
            {fieldErrors.email && (
              <p className="text-xs text-red-600">{fieldErrors.email}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="s-id">
              Student ID{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </Label>
            <Input
              id="s-id"
              name="studentId"
              placeholder="e.g. 2021234567"
              value={formData.studentId}
              onChange={handleChange}
              disabled={isLoading}
            />
          </div>

          <DialogFooter className="gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-gray-900 hover:bg-gray-800 text-white min-w-[100px] rounded-xl"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding…
                </>
              ) : (
                "Add student"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// Edit Project Dialog
// ─────────────────────────────────────────────
function EditProjectDialog({
  open,
  onOpenChange,
  project,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectDetail;
  onSuccess: (updated: Partial<ProjectDetail>) => void;
}) {
  const [formData, setFormData] = useState<ProjectEditFormData>({
    name: project.name,
    description: project.description ?? "",
    driveFolderId: project.driveFolderId ?? "",
  });
  const [fieldErrors, setFieldErrors] = useState<
    FieldErrors<ProjectEditFormData>
  >({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setFormData({
        name: project.name,
        description: project.description ?? "",
        driveFolderId: project.driveFolderId ?? "",
      });
      setFieldErrors({});
    }
  }, [open, project]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name as keyof ProjectEditFormData]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const parsed = projectEditSchema.safeParse(formData);
    if (!parsed.success) {
      const errors: FieldErrors<ProjectEditFormData> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof ProjectEditFormData;
        if (!errors[field]) errors[field] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: parsed.data.name,
          description: parsed.data.description || null,
          driveFolderId: parsed.data.driveFolderId || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 422 && data.details) {
          const serverErrors: FieldErrors<ProjectEditFormData> = {};
          for (const [field, messages] of Object.entries(data.details)) {
            serverErrors[field as keyof ProjectEditFormData] = (
              messages as string[]
            )[0];
          }
          setFieldErrors(serverErrors);
          return;
        }
        toast.error(data.error ?? "Failed to update project.");
        return;
      }

      toast.success("Project updated successfully.");
      onSuccess({
        name: parsed.data.name,
        description: parsed.data.description || null,
        driveFolderId: parsed.data.driveFolderId || null,
      });
      onOpenChange(false);
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>Edit project</DialogTitle>
          <DialogDescription>
            Update the project name, description, or linked Google Drive folder.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="ep-name">
              Project name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="ep-name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              disabled={isLoading}
              className={cn(
                fieldErrors.name && "border-red-400 focus-visible:ring-red-400",
              )}
            />
            {fieldErrors.name && (
              <p className="text-xs text-red-600">{fieldErrors.name}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ep-desc">
              Description{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </Label>
            <Textarea
              id="ep-desc"
              name="description"
              value={formData.description}
              onChange={handleChange}
              disabled={isLoading}
              rows={3}
              className="resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ep-drive">
              Google Drive Folder ID{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </Label>
            <Input
              id="ep-drive"
              name="driveFolderId"
              placeholder="Folder ID from Drive URL"
              value={formData.driveFolderId}
              onChange={handleChange}
              disabled={isLoading}
              className="font-mono text-sm"
            />
            <p className="text-[11px] text-gray-400">
              Students must share their Drive folder with your service account
              email before scanning will work.
            </p>
          </div>

          <DialogFooter className="gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-gray-900 hover:bg-gray-800 text-white min-w-[100px] rounded-xl"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// Students Tab
// ─────────────────────────────────────────────
function StudentsTab({
  students,
  projectId,
  onRefresh,
}: {
  students: Student[];
  projectId: string;
  onRefresh: () => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDeleteStudent(student: Student) {
    if (
      !confirm(
        `Remove ${student.name} from this project? This action cannot be undone.`,
      )
    )
      return;

    setDeletingId(student.id);

    try {
      const res = await fetch(
        `/api/projects/${projectId}/students?studentId=${student.id}`,
        { method: "DELETE" },
      );
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Failed to remove student.");
        return;
      }

      toast.success(data.message ?? "Student removed.");
      onRefresh();
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {students.length} student{students.length !== 1 ? "s" : ""} in this
          project
        </p>
        <Button
          size="sm"
          onClick={() => setAddOpen(true)}
          className="bg-gray-900 hover:bg-gray-800 text-white rounded-xl"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add student
        </Button>
      </div>

      {students.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white py-14 text-center">
          <Users className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm font-medium text-gray-600">No students yet</p>
          <p className="mt-1 text-xs text-gray-400">
            Add students to this project so they receive email notifications
            when their documents are reviewed or approved.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-4 border-blue-200 text-blue-600 hover:bg-blue-50 rounded-xl"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add first student
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Name
                </TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Email
                </TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Student ID
                </TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Added
                </TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => (
                <TableRow key={student.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium text-gray-900">
                    {student.name}
                  </TableCell>
                  <TableCell className="text-gray-600 text-sm">
                    {student.email}
                  </TableCell>
                  <TableCell className="text-gray-500 text-sm font-mono">
                    {student.studentId ?? (
                      <span className="text-gray-300 italic">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-gray-400 text-xs">
                    <span suppressHydrationWarning>{formatDate(student.createdAt)}</span>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-gray-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => handleDeleteStudent(student)}
                      disabled={deletingId === student.id}
                      aria-label={`Remove ${student.name}`}
                    >
                      {deletingId === student.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AddStudentDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        projectId={projectId}
        onSuccess={onRefresh}
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// Documents Tab
// ─────────────────────────────────────────────
function DocumentsTab({
  documents,
  project,
  onRefresh,
}: {
  documents: Document[];
  project: ProjectDetail;
  onRefresh: () => void;
}) {
  const [isScanning, setIsScanning] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"ALL" | "SRS" | "OPPM">("ALL");

  async function handleScanDrive() {
    setIsScanning(true);

    try {
      const res = await fetch("/api/drive/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id }),
      });

      const data = (await res.json()) as ApiSuccess<DriveScanResult> & {
        error?: string;
      };

      if (!res.ok) {
        toast.error(data.error ?? "Drive scan failed.");
        return;
      }

      const { newFiles, modifiedFiles, summary, message } = data.data;
      toast.success(message);

      if (summary.failed > 0 || summary.skipped > 0) {
        toast.warning(
          `${summary.failed} failed, ${summary.skipped} skipped, ${summary.approvedIgnored} approved ignored.`,
        );
      }

      if (
        newFiles?.length > 0 ||
        modifiedFiles?.length > 0 ||
        summary.extracted > 0 ||
        summary.reviewed > 0 ||
        summary.approvedIgnored > 0
      ) {
        onRefresh();
      }
    } catch {
      toast.error("An unexpected error occurred during the Drive scan.");
    } finally {
      setIsScanning(false);
    }
  }

  async function handleGenerateReview(doc: Document) {
    setGeneratingId(doc.id);

    try {
      const res = await fetch(`/api/reviews/${doc.id}/generate`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Failed to generate review.");
        return;
      }

      toast.success("AI review generated successfully!");
      onRefresh();
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setGeneratingId(null);
    }
  }

  const filtered =
    typeFilter === "ALL"
      ? documents
      : documents.filter((d) => d.type === typeFilter);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Select
            value={typeFilter}
            onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}
          >
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All types</SelectItem>
              <SelectItem value="SRS">SRS only</SelectItem>
              <SelectItem value="OPPM">OPPM only</SelectItem>
            </SelectContent>
          </Select>

          <p className="text-xs text-gray-500">
            {filtered.length} document{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={handleScanDrive}
          disabled={isScanning}
          title={
            !project.driveFolderId
              ? "Scan the configured default Drive folder"
              : "Scan for new files uploaded by students"
          }
          className={cn(
            "gap-1.5 text-xs",
            project.driveFolderId
              ? "border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              : "border-gray-200 text-gray-600 hover:bg-gray-50",
          )}
        >
          {isScanning ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FolderSync className="h-3.5 w-3.5" />
          )}
          {isScanning ? "Scanning…" : "Scan Drive for new files"}
        </Button>
      </div>

      {/* No drive folder warning */}
      {!project.driveFolderId && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              No Drive folder linked
            </p>
            <p className="mt-0.5 text-xs text-amber-700">
              Scans will use the configured default Google Drive folder until a
              project-specific Folder ID is added.
            </p>
          </div>
        </div>
      )}

      {/* Documents table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white py-14 text-center">
          <FileText className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm font-medium text-gray-600">
            No documents found
          </p>
          <p className="mt-1 text-xs text-gray-400 max-w-xs">
            {project.driveFolderId
              ? 'Click "Scan Drive for new files" to detect documents uploaded by students.'
              : "Link a Google Drive folder and then scan to import student documents."}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Document
                </TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Type
                </TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Format
                </TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Status
                </TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Drive
                </TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Extraction
                </TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Modified
                </TableHead>
                <TableHead className="w-36 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((doc) => (
                <TableRow key={doc.id} className="hover:bg-gray-50">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 text-sm leading-tight line-clamp-1 max-w-[200px]">
                        {doc.name}
                      </p>
                      {doc.driveUrl && (
                        <a
                          href={doc.driveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-gray-400 hover:text-indigo-600"
                          title="Open in Google Drive"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <DocTypeBadge type={doc.type} />
                  </TableCell>

                  <TableCell>
                    <span className="text-xs text-gray-500">
                      {doc.mimeType ? mimeTypeToLabel(doc.mimeType) : "Unknown"}
                    </span>
                  </TableCell>

                  <TableCell>
                    <DocStatusBadge status={doc.status} />
                  </TableCell>

                  <TableCell>
                    <DriveSyncBadge doc={doc} />
                  </TableCell>

                  <TableCell>
                    <ExtractionBadge extraction={doc.extraction} />
                  </TableCell>

                  <TableCell className="text-xs text-gray-400">
                    <span suppressHydrationWarning>
                      {doc.driveModifiedTime
                        ? formatDateTime(doc.driveModifiedTime)
                        : formatDateTime(doc.createdAt)}
                    </span>
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* View review (if exists) */}
                      {doc.review && (
                        <Button
                          render={<Link href={`/reviews/${doc.review.id}`} />}
                          nativeButton={false}
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-indigo-600 hover:bg-indigo-50"
                        >
                          <Eye className="mr-1 h-3 w-3" />
                          View review
                        </Button>
                      )}

                      {/* LLM review placeholder */}
                      {doc.type !== "UNKNOWN" &&
                        doc.status !== "APPROVED" &&
                        !doc.review?.isApproved && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-violet-600 hover:bg-violet-50"
                          onClick={() => handleGenerateReview(doc)}
                          disabled={
                            process.env.NEXT_PUBLIC_REVIEW_ENABLED !== "true" ||
                            generatingId === doc.id ||
                            doc.status === "REVIEWING" ||
                            doc.extraction?.status !== "EXTRACTED"
                          }
                          title={
                            process.env.NEXT_PUBLIC_REVIEW_ENABLED !== "true"
                              ? "LLM review is not configured yet"
                              : doc.extraction?.status !== "EXTRACTED"
                              ? "Extract the document with a Drive scan before reviewing"
                              : doc.review
                              ? "Re-generate AI review"
                              : "Generate AI review"
                          }
                        >
                          {generatingId === doc.id ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : doc.review ? (
                            <RefreshCw className="mr-1 h-3 w-3" />
                          ) : (
                            <FileSearch className="mr-1 h-3 w-3" />
                          )}
                          {process.env.NEXT_PUBLIC_REVIEW_ENABLED !== "true"
                            ? "Review unavailable"
                            : generatingId === doc.id
                            ? "Analysing…"
                            : doc.review
                              ? "Re-analyse"
                              : "Analyse"}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  const loadProject = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetcher<ApiSuccess<ProjectDetail>>(
        `/api/projects/${projectId}`,
      );
      setProject(res.data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load project.";
      if (message.includes("404") || message.includes("not found")) {
        toast.error("Project not found.");
        router.push("/projects");
      } else {
        toast.error(message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [projectId, router]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  function handleProjectUpdate(updated: Partial<ProjectDetail>) {
    setProject((prev) => (prev ? { ...prev, ...updated } : prev));
  }

  // ── Loading skeleton ─────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="px-8 py-8 max-w-7xl mx-auto w-full space-y-6 animate-fade-in-up">
        {/* Breadcrumb skeleton */}
        <Skeleton className="h-4 w-40" />

        {/* Header skeleton */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>

        {/* Tabs */}
        <Skeleton className="h-10 w-60 rounded-md" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  if (!project) return null;

  const srsCount = project.documents.filter((d) => d.type === "SRS").length;
  const oppmCount = project.documents.filter((d) => d.type === "OPPM").length;
  const pendingCount = project.documents.filter((d) =>
    d.needsReview || ["PENDING", "REVIEWING", "REVIEWED"].includes(d.status),
  ).length;

  return (
    <div className="px-8 py-8 max-w-7xl mx-auto w-full space-y-6 animate-fade-in-up">
      {/* ── Breadcrumb ────────────────────────────────────────────────── */}
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to projects
      </Link>

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 break-words">
            {project.name}
          </h1>
          {project.description ? (
            <p className="mt-1 text-sm text-gray-400 max-w-2xl">
              {project.description}
            </p>
          ) : (
            <p className="mt-1 text-sm text-gray-400 italic">
              No description provided
            </p>
          )}

          {/* Drive folder indicator */}
          {project.driveFolderId ? (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-700">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              Drive folder connected
              <span className="font-mono text-[10px] text-blue-400">
                ({project.driveFolderId.slice(0, 12)}…)
              </span>
            </div>
          ) : (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-500">
              <div className="h-1.5 w-1.5 rounded-full bg-gray-400" />
              No Drive folder linked
            </div>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditOpen(true)}
          className="shrink-0 gap-1.5 rounded-xl border-gray-200 text-gray-500"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit project
        </Button>
      </div>

      <Separator />

      {/* ── Quick stats ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Students",
            value: project.students.length,
            icon: Users,
            color: "text-violet-600",
            bg: "bg-violet-50",
          },
          {
            label: "SRS docs",
            value: srsCount,
            icon: FileText,
            color: "text-indigo-600",
            bg: "bg-indigo-50",
          },
          {
            label: "OPPM docs",
            value: oppmCount,
            icon: FileText,
            color: "text-fuchsia-600",
            bg: "bg-fuchsia-50",
          },
          {
            label: "Pending",
            value: pendingCount,
            icon: Clock,
            color: "text-amber-600",
            bg: "bg-amber-50",
          },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="flex items-center gap-3 rounded-xl border-0 shadow-sm bg-white px-4 py-3"
            >
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl shrink-0",
                  stat.bg,
                )}
              >
                <Icon className={cn("h-4 w-4", stat.color)} />
              </div>
              <div>
                <p className="text-xl font-bold leading-none text-gray-900">
                  {stat.value}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <Tabs defaultValue="documents">
        <TabsList className="h-9">
          <TabsTrigger value="documents" className="text-sm gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Documents
            {project.documents.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 h-4 min-w-[1.25rem] px-1 text-[10px]"
              >
                {project.documents.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="students" className="text-sm gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Students
            {project.students.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 h-4 min-w-[1.25rem] px-1 text-[10px]"
              >
                {project.students.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="mt-4">
          <DocumentsTab
            documents={project.documents}
            project={project}
            onRefresh={loadProject}
          />
        </TabsContent>

        <TabsContent value="students" className="mt-4">
          <StudentsTab
            students={project.students}
            projectId={project.id}
            onRefresh={loadProject}
          />
        </TabsContent>
      </Tabs>

      {/* ── Edit project dialog ───────────────────────────────────────── */}
      {editOpen && (
        <EditProjectDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          project={project}
          onSuccess={handleProjectUpdate}
        />
      )}
    </div>
  );
}
