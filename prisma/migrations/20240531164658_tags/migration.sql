-- CreateTable
CREATE TABLE "Tag" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "situation" INTEGER NOT NULL,
    "commentary" TEXT,
    "projectId" INTEGER,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TagValue" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "situation" INTEGER NOT NULL,
    "commentary" TEXT,
    "data" JSONB,
    "projectId" INTEGER,
    "tagId" INTEGER NOT NULL,

    CONSTRAINT "TagValue_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagValue" ADD CONSTRAINT "TagValue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagValue" ADD CONSTRAINT "TagValue_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
