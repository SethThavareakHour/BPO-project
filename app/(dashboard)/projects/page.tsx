"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  FolderKanban,
  Users,
  FileText,
  Clock,
  CheckCircle2,
  Search,
  Loader2,
  MoreVertical,
  Pencil,
  Trash2,
  FolderOpen,
  Filter,
} from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FolderCard } from "@/components/dashboard/folder-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fetcher, formatDate, cn } from "@/lib/utils";
import type { ApiSuccess } from "@/types";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface ProjectEnriched {
  id: string;
  name: string;
  description: string | null;
  driveFolderId: string | null;
  advisorId: string;
  createdAt: string;
  updatedAt: string;
  _count: {
    students: number;
    documents: number;
  };
  pendingCount: number;
  srsCount: number;
  oppmCount: number;
}

// ─────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────
const projectSchema = z.object({
  name: z
    .string()
    .min(2, "Project name must be at least 2 characters")
    .max(150, "Project name must be at most 150 characters")
    .trim(),
  description: z
    .string()
    .max(500, "Description must be at most 500 characters")
    .trim()
    .optional(),
  driveFolderId: z.string().trim().optional(),
});

type ProjectFormData = z.infer<typeof projectSchema>;
type FieldErrors = Partial<Record<keyof ProjectFormData, string>>;

// ─────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────
function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white py-20 text-center animate-fade-in">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50">
        <FolderKanban className="h-8 w-8 text-blue-500" />
      </div>
      <h3 className="mb-1 text-lg font-semibold text-gray-900">
        No projects yet
      </h3>
      <p className="mb-6 max-w-xs text-sm text-gray-400">
        Create your first project to start managing student SRS and OPPM
        documents.
      </p>
      <Button
        onClick={onCreateClick}
        className="bg-gray-900 hover:bg-gray-800 text-white rounded-xl px-5"
      >
        <Plus className="mr-2 h-4 w-4" />
        Create your first project
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Project card skeleton
// ─────────────────────────────────────────────
function ProjectCardSkeleton() {
  return (
    <div className="relative w-full h-[205px] rounded-[20px] overflow-hidden shadow-sm bg-gray-100">
      <Skeleton className="absolute top-[20px] left-[14px] right-[14px] bottom-8 rounded-t-[12px] bg-white pt-3 px-4" />
      <Skeleton className="absolute bottom-0 left-0 right-0 h-[78%] bg-blue-100" />
      <div className="absolute top-[40%] left-0 right-0 bottom-0 z-20 px-5 pb-5 pt-1 flex flex-col justify-end gap-2">
        <Skeleton className="h-4 w-1/2 bg-blue-300" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-1/3 bg-blue-300 pb-0.5 border-b border-white/5" />
          <Skeleton className="h-3 w-1/4 bg-blue-300 pb-0.5 border-b border-white/5" />
          <Skeleton className="h-3 w-1/5 bg-blue-300" />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Project card — Folder Aesthetic (Dribbble Accurate)
// ─────────────────────────────────────────────
const ProjectCard = React.memo(function ProjectCard({
  project,
  onEdit,
  onDelete,
}: {
  project: ProjectEnriched;
  onEdit: (project: ProjectEnriched) => void;
  onDelete: (project: ProjectEnriched) => void;
}) {
  const router = useRouter();

  // White inner paper content
  const InnerPaper = useMemo(() => (
    <div className="h-full flex flex-col relative z-50">
      <div className="flex justify-between items-start">
        <div className="flex-1" />

        {/* Actions menu */}
        <div onClick={(e) => e.stopPropagation()} className="ml-2 -mt-2 -mr-3">
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 focus:outline-none transition-colors"
            >
              <MoreVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 rounded-xl">
              <DropdownMenuItem className="cursor-pointer rounded-lg" onClick={() => router.push(`/projects/${project.id}`)}>
                <FolderOpen className="mr-2 h-4 w-4" /> Open project
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer rounded-lg" onClick={() => onEdit(project)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit project
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-700 rounded-lg" onClick={() => onDelete(project)}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  ), [project.description, project.id, onEdit, onDelete, router]);

  // Stats displayed on the blue front flap
  const FrontStats = useMemo(() => (
    <>
      <div className="space-y-1">
        <div className="flex justify-between items-center text-white/95 font-bold pb-1 border-b border-white/10 text-[10.5px]">
          <span>{project.srsCount} SRS Documents</span>
        </div>
        <div className="flex justify-between items-center text-white/95 font-bold pb-1 border-b border-white/10 text-[10.5px]">
          <span>{project.oppmCount} OPPM Documents</span>
          {project.pendingCount > 0 && (
            <span className="text-[10px] bg-white text-blue-600 font-black px-1.5 py-0.5 rounded-full shadow-sm">
              {project.pendingCount}
            </span>
          )}
        </div>
      </div>
      <div className="flex justify-between items-center text-white/95 font-bold pt-1 text-[11px]">
        <span>{project._count.students} Students</span>
      </div>
    </>
  ), [project._count.students, project.srsCount, project.oppmCount, project.pendingCount]);

  return (
    <FolderCard
      onClick={() => router.push(`/projects/${project.id}`)}
      contentTitle={project.name}
      contentStats={FrontStats}
      isActive={true} // Default active to get the blue theme
    >
      {InnerPaper}
    </FolderCard>
  );
});

// ─────────────────────────────────────────────
// Create / Edit project dialog
// ─────────────────────────────────────────────
function ProjectFormDialog({
  open,
  onOpenChange,
  editProject,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editProject: ProjectEnriched | null;
  onSuccess: () => void;
}) {
  const isEditing = !!editProject;

  const [formData, setFormData] = useState<ProjectFormData>({
    name: "",
    description: "",
    driveFolderId: "",
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  // Populate form when editing
  useEffect(() => {
    if (editProject) {
      setFormData({
        name: editProject.name,
        description: editProject.description ?? "",
        driveFolderId: editProject.driveFolderId ?? "",
      });
    } else {
      setFormData({ name: "", description: "", driveFolderId: "" });
    }
    setFieldErrors({});
  }, [editProject, open]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name as keyof ProjectFormData]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const parsed = projectSchema.safeParse(formData);
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof ProjectFormData;
        if (!errors[field]) errors[field] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);

    try {
      const url = isEditing
        ? `/api/projects/${editProject!.id}`
        : "/api/projects";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
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
          const serverErrors: FieldErrors = {};
          for (const [field, messages] of Object.entries(data.details)) {
            serverErrors[field as keyof ProjectFormData] = (
              messages as string[]
            )[0];
          }
          setFieldErrors(serverErrors);
          return;
        }
        toast.error(data.error ?? "Failed to save project.");
        return;
      }

      toast.success(
        isEditing
          ? "Project updated successfully."
          : "Project created successfully.",
      );
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
      <DialogContent className="sm:max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {isEditing ? "Edit project" : "Create new project"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the project details below."
              : "Fill in the details to create a new student project."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="proj-name">
              Project name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="proj-name"
              name="name"
              placeholder="e.g. Group 5 — Smart Parking System"
              value={formData.name}
              onChange={handleChange}
              disabled={isLoading}
              className={cn(
                "rounded-xl",
                fieldErrors.name && "border-red-400 focus-visible:ring-red-400",
              )}
            />
            {fieldErrors.name && (
              <p className="text-xs text-red-600">{fieldErrors.name}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="proj-description">
              Description{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </Label>
            <Textarea
              id="proj-description"
              name="description"
              placeholder="Brief description of the project, group members, or semester..."
              value={formData.description}
              onChange={handleChange}
              disabled={isLoading}
              rows={3}
              className={cn(
                "resize-none rounded-xl",
                fieldErrors.description &&
                "border-red-400 focus-visible:ring-red-400",
              )}
            />
            <div className="flex items-center justify-between">
              {fieldErrors.description ? (
                <p className="text-xs text-red-600">
                  {fieldErrors.description}
                </p>
              ) : (
                <span />
              )}
              <p className="text-[11px] text-gray-400 ml-auto">
                {(formData.description ?? "").length}/500
              </p>
            </div>
          </div>

          {/* Drive Folder ID */}
          <div className="space-y-1.5">
            <Label htmlFor="proj-drive">
              Google Drive Folder ID{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </Label>
            <Input
              id="proj-drive"
              name="driveFolderId"
              placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
              value={formData.driveFolderId}
              onChange={handleChange}
              disabled={isLoading}
              className={cn(
                "font-mono text-sm rounded-xl",
                fieldErrors.driveFolderId &&
                "border-red-400 focus-visible:ring-red-400",
              )}
            />
            {fieldErrors.driveFolderId ? (
              <p className="text-xs text-red-600">
                {fieldErrors.driveFolderId}
              </p>
            ) : (
              <p className="text-[11px] text-gray-400">
                Copy the folder ID from the Google Drive URL. Share the folder
                with your service account email first.
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="rounded-xl"
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
              ) : isEditing ? (
                "Save changes"
              ) : (
                "Create project"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// Delete confirmation dialog
// ─────────────────────────────────────────────
function DeleteConfirmDialog({
  project,
  open,
  onOpenChange,
  onSuccess,
}: {
  project: ProjectEnriched | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);

  async function handleDelete() {
    if (!project) return;
    setIsLoading(true);

    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Failed to delete project.");
        return;
      }

      toast.success(data.message ?? "Project deleted successfully.");
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
          <DialogTitle className="text-lg font-semibold text-gray-900">
            Delete project
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-gray-800">
              &quot;{project?.name}&quot;
            </span>
            ? This will permanently remove all students, documents, and reviews
            associated with this project. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 mt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="rounded-xl"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isLoading}
            className="min-w-[100px] rounded-xl"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting…
              </>
            ) : (
              "Delete project"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectEnriched[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [editProject, setEditProject] = useState<ProjectEnriched | null>(null);
  const [deleteProject, setDeleteProject] = useState<ProjectEnriched | null>(
    null,
  );

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetcher<ApiSuccess<ProjectEnriched[]>>("/api/projects");
      setProjects(res.data);
    } catch {
      toast.error("Failed to load projects.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // ── Filtered list ─────────────────────────────────────────────────────
  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description ?? "").toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="px-8 py-8 max-w-7xl mx-auto w-full space-y-6 animate-fade-in-up">
      {/* ── Page header (Subtle but Clear) ─────────────────────────── */}
      <div className="flex items-center gap-3 text-gray-900">
        <FolderKanban className="h-7 w-7" />
        <h1 className="text-2xl font-black tracking-tight">
          Student Projects
        </h1>
      </div>

      {/* ── Action Bar (Search & Create) ─────────────────────────────── */}
      {(projects.length > 0 || isLoading) && (
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
            <Input
              placeholder="Search projects…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 rounded-xl border-gray-200 bg-white"
            />
          </div>

          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-gray-900 hover:bg-gray-800 text-white shrink-0 rounded-xl px-5"
          >
            <Plus className="mr-2 h-4 w-4" />
            New project
          </Button>
        </div>
      )}

      {/* ── Content ──────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState onCreateClick={() => setCreateOpen(true)} />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
          <Search className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm font-medium text-gray-600">No projects found</p>
          <p className="mt-1 text-xs text-gray-400">
            No projects match &quot;{searchQuery}&quot;. Try a different search
            term.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 text-blue-600"
            onClick={() => setSearchQuery("")}
          >
            Clear search
          </Button>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-400">
            Showing{" "}
            <span className="font-medium text-gray-600">{filtered.length}</span>{" "}
            of{" "}
            <span className="font-medium text-gray-600">{projects.length}</span>{" "}
            project{projects.length !== 1 ? "s" : ""}
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filtered.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onEdit={(p) => setEditProject(p)}
                onDelete={(p) => setDeleteProject(p)}
              />
            ))}
          </div>
        </>
      )}

      {/* ── Create / Edit dialog ─────────────────────────────────────── */}
      <ProjectFormDialog
        open={createOpen || !!editProject}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setEditProject(null);
          } else {
            setCreateOpen(true);
          }
        }}
        editProject={editProject}
        onSuccess={loadProjects}
      />

      {/* ── Delete confirm dialog ────────────────────────────────────── */}
      <DeleteConfirmDialog
        project={deleteProject}
        open={!!deleteProject}
        onOpenChange={(open) => {
          if (!open) setDeleteProject(null);
        }}
        onSuccess={loadProjects}
      />
    </div>
  );
}
