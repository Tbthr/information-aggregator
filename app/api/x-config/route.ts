import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DEFAULT_CONFIGS = [
  { tab: "home", birdMode: "home" },
  { tab: "bookmarks", birdMode: "bookmarks" },
  { tab: "likes", birdMode: "likes" },
  { tab: "lists", birdMode: "list" },
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab");

  // Ensure default configs exist
  for (const dc of DEFAULT_CONFIGS) {
    const exists = await prisma.xPageConfig.findUnique({ where: { tab: dc.tab } });
    if (!exists) {
      await prisma.xPageConfig.create({ data: dc });
    }
  }

  if (tab) {
    const config = await prisma.xPageConfig.findUnique({ where: { tab } });
    if (!config) {
      return NextResponse.json({ success: false, error: "Config not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: config });
  }

  const configs = await prisma.xPageConfig.findMany({ orderBy: { tab: "asc" } });
  return NextResponse.json({ success: true, data: configs });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const tab = body.tab;

  if (!tab) {
    return NextResponse.json({ success: false, error: "tab is required" }, { status: 400 });
  }

  const config = await prisma.xPageConfig.upsert({
    where: { tab },
    create: {
      tab,
      enabled: body.enabled ?? true,
      birdMode: body.birdMode || tab,
      count: body.count ?? 20,
      fetchAll: body.fetchAll ?? false,
      maxPages: body.maxPages,
      authTokenEnv: body.authTokenEnv,
      ct0Env: body.ct0Env,
      listsJson: body.listsJson,
      filterPrompt: body.filterPrompt,
      enrichEnabled: body.enrichEnabled ?? true,
      enrichScoring: body.enrichScoring ?? true,
      enrichKeyPoints: body.enrichKeyPoints ?? true,
      enrichTagging: body.enrichTagging ?? true,
      timeWindow: body.timeWindow ?? "week",
      sortOrder: body.sortOrder ?? "ranked",
    },
    update: {
      enabled: body.enabled,
      birdMode: body.birdMode,
      count: body.count,
      fetchAll: body.fetchAll,
      maxPages: body.maxPages,
      authTokenEnv: body.authTokenEnv,
      ct0Env: body.ct0Env,
      listsJson: body.listsJson,
      filterPrompt: body.filterPrompt,
      enrichEnabled: body.enrichEnabled,
      enrichScoring: body.enrichScoring,
      enrichKeyPoints: body.enrichKeyPoints,
      enrichTagging: body.enrichTagging,
      timeWindow: body.timeWindow,
      sortOrder: body.sortOrder,
    },
  });

  return NextResponse.json({ success: true, data: config });
}
