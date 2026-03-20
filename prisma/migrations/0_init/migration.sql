-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "snippet" TEXT,
    "sourceId" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "packId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "author" TEXT,
    "summary" TEXT,
    "bullets" TEXT[],
    "content" TEXT,
    "imageUrl" TEXT,
    "categories" TEXT[],
    "score" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "scoresJson" TEXT,
    "metadataJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "configJson" TEXT,
    "packId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceHealth" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "lastError" TEXT,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceHealth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pack" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "policyJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bookmark" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "bookmarkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsFlash" (
    "id" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "itemId" TEXT,
    "dailyDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsFlash_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyOverview" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "dayLabel" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "itemIds" TEXT[],
    "spotlightIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyOverview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyReport" (
    "id" TEXT NOT NULL,
    "weekNumber" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "subheadline" TEXT,
    "editorial" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimelineEvent" (
    "id" TEXT NOT NULL,
    "weeklyReportId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "dayLabel" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "itemIds" TEXT[],

    CONSTRAINT "TimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomView" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomViewItem" (
    "id" TEXT NOT NULL,
    "viewId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CustomViewItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Item_sourceId_idx" ON "Item"("sourceId");

-- CreateIndex
CREATE INDEX "Item_fetchedAt_idx" ON "Item"("fetchedAt");

-- CreateIndex
CREATE INDEX "Item_score_idx" ON "Item"("score");

-- CreateIndex
CREATE UNIQUE INDEX "SourceHealth_sourceId_key" ON "SourceHealth"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Bookmark_itemId_key" ON "Bookmark"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyOverview_date_key" ON "DailyOverview"("date");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReport_weekNumber_key" ON "WeeklyReport"("weekNumber");

-- CreateIndex
CREATE INDEX "TimelineEvent_weeklyReportId_idx" ON "TimelineEvent"("weeklyReportId");

-- CreateIndex
CREATE INDEX "CustomViewItem_viewId_idx" ON "CustomViewItem"("viewId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomViewItem_viewId_itemId_key" ON "CustomViewItem"("viewId", "itemId");

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Source" ADD CONSTRAINT "Source_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceHealth" ADD CONSTRAINT "SourceHealth_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsFlash" ADD CONSTRAINT "NewsFlash_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_weeklyReportId_fkey" FOREIGN KEY ("weeklyReportId") REFERENCES "WeeklyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomViewItem" ADD CONSTRAINT "CustomViewItem_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "CustomView"("id") ON DELETE CASCADE ON UPDATE CASCADE;

