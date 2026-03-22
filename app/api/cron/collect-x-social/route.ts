import { NextResponse } from "next/server";
import { verifyCronRequest, unauthorizedResponse, runAfterJob } from "../_lib";
import { runCollectXCron } from "../_lib-x";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!verifyCronRequest(request)) {
    return unauthorizedResponse();
  }

  runAfterJob("collect-x-social", () =>
    runCollectXCron({ tabFilter: ["bookmarks", "likes"], label: "collect-x-social", skipAiEnrich: true }),
  );

  return NextResponse.json({ success: true, message: "X social collect job started" }, { status: 202 });
}
