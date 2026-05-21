-- Add document extraction state and scan event history.
CREATE TYPE "ExtractionStatus" AS ENUM ('PENDING', 'EXTRACTED', 'FAILED');
CREATE TYPE "ExtractionMethod" AS ENUM (
  'GOOGLE_EXPORT',
  'PDF_TEXT',
  'DOCX',
  'XLSX',
  'CSV',
  'TEXT',
  'DEEPSEEK_OCR',
  'UNSUPPORTED'
);
CREATE TYPE "ScanEventType" AS ENUM (
  'IMPORTED',
  'MODIFIED',
  'UNCHANGED',
  'EXTRACTED',
  'EXTRACTION_FAILED',
  'REVIEWED',
  'REVIEW_FAILED',
  'APPROVED_IGNORED'
);

CREATE TABLE "DocumentExtraction" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "text" TEXT,
  "status" "ExtractionStatus" NOT NULL DEFAULT 'PENDING',
  "method" "ExtractionMethod" NOT NULL,
  "error" TEXT,
  "sourceModifiedTime" TIMESTAMP(3),
  "extractedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DocumentExtraction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentScanEvent" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "eventType" "ScanEventType" NOT NULL,
  "driveModifiedTime" TIMESTAMP(3),
  "message" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DocumentScanEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentExtraction_documentId_key" ON "DocumentExtraction"("documentId");
CREATE INDEX "DocumentScanEvent_documentId_idx" ON "DocumentScanEvent"("documentId");

ALTER TABLE "DocumentExtraction"
  ADD CONSTRAINT "DocumentExtraction_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DocumentScanEvent"
  ADD CONSTRAINT "DocumentScanEvent_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
