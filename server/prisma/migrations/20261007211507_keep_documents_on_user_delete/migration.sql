-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "uploadedByEmail" TEXT,
    "uploadedByName" TEXT,
    "originalFilename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "deletedAt" DATETIME,
    CONSTRAINT "Document_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Document" ("deletedAt", "errorMessage", "id", "mimeType", "originalFilename", "projectId", "sizeBytes", "status", "storageKey", "uploadedAt", "uploadedById") SELECT "deletedAt", "errorMessage", "id", "mimeType", "originalFilename", "projectId", "sizeBytes", "status", "storageKey", "uploadedAt", "uploadedById" FROM "Document";
DROP TABLE "Document";
ALTER TABLE "new_Document" RENAME TO "Document";
CREATE INDEX "Document_projectId_idx" ON "Document"("projectId");
CREATE INDEX "Document_uploadedById_idx" ON "Document"("uploadedById");
CREATE INDEX "Document_deletedAt_idx" ON "Document"("deletedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Backfill the uploader snapshot from the live account (P1).
UPDATE "Document"
SET "uploadedByEmail" = (SELECT "email" FROM "User" WHERE "User"."id" = "Document"."uploadedById"),
    "uploadedByName"  = (SELECT NULLIF(TRIM("fullName"), '') FROM "User" WHERE "User"."id" = "Document"."uploadedById")
WHERE "uploadedById" IS NOT NULL;

-- Admin-created and approved accounts count as verified (P3).
UPDATE "User"
SET "emailVerifiedAt" = strftime('%Y-%m-%dT%H:%M:%f+00:00', 'now')
WHERE "accountStatus" = 'ACTIVE'
  AND "emailVerifiedAt" IS NULL
  AND "emailVerificationToken" IS NULL;

