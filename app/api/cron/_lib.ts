import { NextResponse } from "next/server";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * 验证 Cron 请求来源
 * Vercel Cron Jobs 会在请求头中携带 Authorization: Bearer <CRON_SECRET>
 */
export function verifyCronRequest(request: Request): boolean {
  if (!CRON_SECRET) {
    // 开发环境不验证
    if (process.env.NODE_ENV === "development") return true;
    return false;
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;

  const expected = `Bearer ${CRON_SECRET}`;
  return authHeader === expected;
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
