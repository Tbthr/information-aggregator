import { NextResponse } from "next/server";
import { verifyCronRequest, unauthorizedResponse, runAfterJob } from "../_lib";
import { runCollectXCron } from "../_lib-x";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!verifyCronRequest(request)) {
    return unauthorizedResponse();
  }

  runAfterJob("collect-x-feed", () =>
    runCollectXCron({ tabFilter: ["home", "lists"], label: "collect-x-feed" }),
  );

  return NextResponse.json({ success: true, message: "X feed collect job started" }, { status: 202 });
}
