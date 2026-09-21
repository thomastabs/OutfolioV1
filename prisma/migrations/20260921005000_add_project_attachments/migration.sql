CREATE TABLE "ProjectAttachment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileType" TEXT NOT NULL DEFAULT '',
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "isOmlFile" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OmlMetadata" (
    "id" TEXT NOT NULL,
    "attachmentId" TEXT NOT NULL,
    "moduleName" TEXT NOT NULL,
    "version" TEXT NOT NULL,

    CONSTRAINT "OmlMetadata_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OmlMetadata_attachmentId_key" ON "OmlMetadata"("attachmentId");

CREATE INDEX "ProjectAttachment_projectId_idx" ON "ProjectAttachment"("projectId");

ALTER TABLE "ProjectAttachment" ADD CONSTRAINT "ProjectAttachment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OmlMetadata" ADD CONSTRAINT "OmlMetadata_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "ProjectAttachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
