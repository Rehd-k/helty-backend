-- CreateTable
CREATE TABLE "ImshAndroidRelease" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "relativePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImshAndroidRelease_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImshAndroidRelease_version_key" ON "ImshAndroidRelease"("version");

-- CreateIndex
CREATE INDEX "ImshAndroidRelease_createdAt_idx" ON "ImshAndroidRelease"("createdAt");
