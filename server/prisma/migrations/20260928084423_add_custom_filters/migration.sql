-- CreateTable
CREATE TABLE "FilterDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdById" TEXT,
    CONSTRAINT "FilterDefinition_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentFilterValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "filterDefinitionId" TEXT NOT NULL,
    "valueText" TEXT,
    "valueNumber" REAL,
    "valueDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DocumentFilterValue_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentFilterValue_filterDefinitionId_fkey" FOREIGN KEY ("filterDefinitionId") REFERENCES "FilterDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "FilterDefinition_name_key" ON "FilterDefinition"("name");

-- CreateIndex
CREATE INDEX "FilterDefinition_order_idx" ON "FilterDefinition"("order");

-- CreateIndex
CREATE INDEX "DocumentFilterValue_filterDefinitionId_idx" ON "DocumentFilterValue"("filterDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentFilterValue_documentId_filterDefinitionId_key" ON "DocumentFilterValue"("documentId", "filterDefinitionId");
