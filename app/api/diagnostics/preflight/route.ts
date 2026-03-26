/**
 * Diagnostics Preflight API
 *
 * Returns environment and database information for split-brain detection.
 * Used by the diagnostics CLI to verify environment consistency.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success } from "@/lib/api-response";
import { inferEnvFromDatabaseUrl } from "@/src/diagnostics/core/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const databaseUrl = process.env.DATABASE_URL ?? "";
  const diagnosticsEnv = process.env.DIAGNOSTICS_ENV ?? "test";
  const apiUrl = process.env.API_URL ?? new URL(request.url).origin;

  // Infer environment from database URL
  const inferredEnv = inferEnvFromDatabaseUrl(databaseUrl);

  // Get database host (redacted)
  let dbHost = "unknown";
  try {
    if (databaseUrl) {
      const parsed = new URL(databaseUrl);
      dbHost = `${parsed.protocol}//${parsed.host}/${parsed.pathname.replace(/^\//, "")}`;
    }
  } catch {
    dbHost = databaseUrl ? databaseUrl.split("@")[1]?.split("/")[0] ?? "unknown" : "unknown";
  }

  // Try to ping the database
  let dbReachable = false;
  let dbError: string | null = null;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbReachable = true;
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  // Determine reported environment from the API itself
  // Vercel provides region info
  const region = process.env.VERCEL_REGION ?? "unknown";

  return success({
    environment: {
      effective: diagnosticsEnv as "test" | "production",
      inferred: inferredEnv,
      region,
    },
    dbHost,
    dbReachable,
    dbError: dbError ? String(dbError) : null,
    apiUrl,
    timestamp: new Date().toISOString(),
  });
}
