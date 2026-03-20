/*
  Warnings:

  - You are about to drop the `CustomViewItem` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `updatedAt` to the `CustomView` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "CustomViewItem" DROP CONSTRAINT "CustomViewItem_viewId_fkey";

-- AlterTable
ALTER TABLE "CustomView" ADD COLUMN     "filterJson" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- DropTable
DROP TABLE "CustomViewItem";

-- CreateTable
CREATE TABLE "CustomViewPack" (
    "id" TEXT NOT NULL,
    "viewId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,

    CONSTRAINT "CustomViewPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "defaultProvider" TEXT NOT NULL DEFAULT 'anthropic',
    "defaultBatchSize" INTEGER NOT NULL DEFAULT 3,
    "defaultConcurrency" INTEGER NOT NULL DEFAULT 1,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "initialDelay" INTEGER NOT NULL DEFAULT 1000,
    "maxDelay" INTEGER NOT NULL DEFAULT 30000,
    "backoffFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "anthropicConfig" TEXT,
    "geminiConfig" TEXT,
    "openaiConfig" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchedulerJob" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cron" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchedulerJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyReportConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "packs" TEXT NOT NULL DEFAULT 'all',
    "maxItems" INTEGER NOT NULL DEFAULT 20,
    "maxSpotlight" INTEGER NOT NULL DEFAULT 3,
    "sort" TEXT NOT NULL DEFAULT 'ranked',
    "enableOverview" BOOLEAN NOT NULL DEFAULT true,
    "newsFlashesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "newsFlashesMaxCount" INTEGER NOT NULL DEFAULT 12,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyReportConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyReportConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "days" INTEGER NOT NULL DEFAULT 7,
    "maxTimelineEvents" INTEGER NOT NULL DEFAULT 10,
    "maxDeepDives" INTEGER NOT NULL DEFAULT 5,
    "enableEditorial" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyReportConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "adapter" TEXT NOT NULL,
    "configJson" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomViewPack_viewId_idx" ON "CustomViewPack"("viewId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomViewPack_viewId_packId_key" ON "CustomViewPack"("viewId", "packId");

-- AddForeignKey
ALTER TABLE "CustomViewPack" ADD CONSTRAINT "CustomViewPack_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "CustomView"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomViewPack" ADD CONSTRAINT "CustomViewPack_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
