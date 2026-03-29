-- CreateTable
CREATE TABLE "HeltyDesktopRelease" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "relativePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HeltyDesktopRelease_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HeltyDesktopRelease_version_key" ON "HeltyDesktopRelease"("version");

-- CreateIndex
CREATE INDEX "HeltyDesktopRelease_createdAt_idx" ON "HeltyDesktopRelease"("createdAt");
