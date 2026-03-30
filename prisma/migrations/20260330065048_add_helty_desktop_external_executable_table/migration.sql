-- CreateTable
CREATE TABLE "HeltyDesktopExternalExecutable" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "description" TEXT,
    "relativePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HeltyDesktopExternalExecutable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HeltyDesktopExternalExecutable_fileName_key" ON "HeltyDesktopExternalExecutable"("fileName");

-- CreateIndex
CREATE INDEX "HeltyDesktopExternalExecutable_createdAt_idx" ON "HeltyDesktopExternalExecutable"("createdAt");
