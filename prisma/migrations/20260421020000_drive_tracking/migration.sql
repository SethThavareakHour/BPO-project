-- Add Drive-backed change tracking for imported student documents.
CREATE TYPE "DriveSyncStatus" AS ENUM ('NEW', 'MODIFIED', 'SYNCED');

ALTER TABLE "Document"
  ADD COLUMN "driveCreatedTime" TIMESTAMP(3),
  ADD COLUMN "driveModifiedTime" TIMESTAMP(3),
  ADD COLUMN "driveLastSeenAt" TIMESTAMP(3),
  ADD COLUMN "driveLastSyncedAt" TIMESTAMP(3),
  ADD COLUMN "driveSyncStatus" "DriveSyncStatus" NOT NULL DEFAULT 'NEW',
  ADD COLUMN "needsReview" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "reviewCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastReviewedAt" TIMESTAMP(3);
