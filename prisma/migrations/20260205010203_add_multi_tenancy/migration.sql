-- CreateTable: Organization
CREATE TABLE "Organization" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "logo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable: OrganizationMember
CREATE TABLE "OrganizationMember" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable: OrganizationInvite
CREATE TABLE "OrganizationInvite" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrganizationInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
CREATE UNIQUE INDEX "OrganizationMember_organizationId_userId_key" ON "OrganizationMember"("organizationId", "userId");
CREATE UNIQUE INDEX "OrganizationInvite_token_key" ON "OrganizationInvite"("token");

-- Backfill: Create default organization
INSERT INTO "Organization" ("name", "slug", "plan", "createdAt", "updatedAt")
VALUES ('Organização Padrão', 'default', 'free', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Backfill: Add all existing users as owners of default org
INSERT INTO "OrganizationMember" ("organizationId", "userId", "role", "joinedAt")
SELECT
    (SELECT "id" FROM "Organization" WHERE "slug" = 'default'),
    "id",
    'owner',
    CURRENT_TIMESTAMP
FROM "User";

-- AlterTable: User - add defaultOrgId
ALTER TABLE "User" ADD COLUMN "defaultOrgId" INTEGER;

-- Backfill: Set defaultOrgId for all users
UPDATE "User" SET "defaultOrgId" = (SELECT "id" FROM "Organization" WHERE "slug" = 'default');

-- AlterTable: Project - add organizationId as NULLABLE first
ALTER TABLE "Project" ADD COLUMN "organizationId" INTEGER;

-- Backfill: Set organizationId for all projects
UPDATE "Project" SET "organizationId" = (SELECT "id" FROM "Organization" WHERE "slug" = 'default');

-- AlterTable: Project - make organizationId NOT NULL after backfill
ALTER TABLE "Project" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable: add organizationId to other tables (nullable)
ALTER TABLE "Template" ADD COLUMN "organizationId" INTEGER;
ALTER TABLE "File" ADD COLUMN "organizationId" INTEGER;
ALTER TABLE "Notification" ADD COLUMN "organizationId" INTEGER;
ALTER TABLE "Tag" ADD COLUMN "organizationId" INTEGER;
ALTER TABLE "TagValue" ADD COLUMN "organizationId" INTEGER;

-- Backfill: Set organizationId for existing records in other tables
UPDATE "Template" SET "organizationId" = (SELECT "id" FROM "Organization" WHERE "slug" = 'default') WHERE "projectId" IS NOT NULL;
UPDATE "Tag" SET "organizationId" = (SELECT "id" FROM "Organization" WHERE "slug" = 'default') WHERE "projectId" IS NOT NULL;
UPDATE "TagValue" SET "organizationId" = (SELECT "id" FROM "Organization" WHERE "slug" = 'default') WHERE "projectId" IS NOT NULL;

-- CreateIndex
CREATE INDEX "File_organizationId_idx" ON "File"("organizationId");
CREATE INDEX "Notification_organizationId_idx" ON "Notification"("organizationId");
CREATE INDEX "Project_organizationId_idx" ON "Project"("organizationId");
CREATE INDEX "Project_organizationId_creatorId_idx" ON "Project"("organizationId", "creatorId");
CREATE INDEX "Tag_organizationId_idx" ON "Tag"("organizationId");
CREATE INDEX "TagValue_organizationId_idx" ON "TagValue"("organizationId");
CREATE INDEX "Template_organizationId_idx" ON "Template"("organizationId");

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationInvite" ADD CONSTRAINT "OrganizationInvite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Template" ADD CONSTRAINT "Template_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "File" ADD CONSTRAINT "File_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TagValue" ADD CONSTRAINT "TagValue_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
