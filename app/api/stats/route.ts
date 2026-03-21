import { NextResponse } from "next/server";
import { verifyCronRequest, unauthorizedResponse } from "../cron/_lib";
import { getArchiveStats } from "../../../src/archive/upsert-prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!verifyCronRequest(request)) {
    return unauthorizedResponse();
  }

  const stats = await getArchiveStats();

  return NextResponse.json({
    totalItems: stats.totalItems,
    oldestItem: stats.oldestItem,
    newestItem: stats.newestItem,
    bySource: stats.bySource.map((s) => ({
      sourceId: s.sourceId,
      count: Number(s.count),
    })),
  });
}
