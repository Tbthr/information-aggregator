// Diagnostics Framework Core Guards

import type {
  DiagnosticsMode,
  DiagnosticsEnv,
  DiagnosticsRiskLevel,
  DiagnosticsArgs,
  NormalizeResult,
} from "./types";

/**
 * Infers environment from database URL
 */
export function inferEnvFromDatabaseUrl(url: string): DiagnosticsEnv | "unknown" {
  const lower = url.toLowerCase();

  if (lower.includes("test")) {
    return "test";
  }

  if (lower.includes("prod")) {
    return "production";
  }

  return "unknown";
}

/**
 * Redacts sensitive information from database URL for display
 */
export function redactDatabaseHost(url: string): string {
  // Remove password and port
  // URL format: postgresql://user:password@host:port/dbname
  try {
    const parsed = new URL(url);
    const user = parsed.username ? `${parsed.username}@` : "";
    const host = parsed.hostname || "";
    const database = parsed.pathname.replace(/^\//, "");

    return `${parsed.protocol}//${user}${host}/${database}`;
  } catch {
    // If URL parsing fails, do a simple replacement
    return url
      .replace(/:[^:@]+@/, "@") // remove password
      .replace(/:(\d+)/, ""); // remove port
  }
}

export interface NormalizeAndValidateArgsOptions {
  mode: DiagnosticsMode;
  runCollection?: boolean;
  configOnly?: boolean;
  dailyOnly?: boolean;
  weeklyOnly?: boolean;
  cleanup?: boolean;
  allowWrite?: boolean;
  confirmProduction?: boolean;
  confirmCleanup?: boolean;
}

/**
 * Normalizes and validates CLI arguments
 */
export function normalizeAndValidateArgs(
  mode: DiagnosticsMode,
  rawArgs: NormalizeAndValidateArgsOptions
): NormalizeResult {
  const errors: string[] = [];

  // Validate illegal combinations based on mode
  switch (mode) {
    case "collection":
      if (rawArgs.cleanup) {
        errors.push("cleanup is not allowed in collection mode");
      }
      if (rawArgs.configOnly) {
        errors.push("config-only is not allowed in collection mode");
      }
      if (rawArgs.dailyOnly) {
        errors.push("daily-only is not allowed in collection mode");
      }
      if (rawArgs.weeklyOnly) {
        errors.push("weekly-only is not allowed in collection mode");
      }
      break;

    case "reports":
      if (rawArgs.configOnly && rawArgs.cleanup) {
        errors.push("config-only cannot be combined with cleanup");
      }
      if (rawArgs.configOnly && rawArgs.dailyOnly) {
        errors.push("config-only cannot be combined with daily-only");
      }
      if (rawArgs.configOnly && rawArgs.weeklyOnly) {
        errors.push("config-only cannot be combined with weekly-only");
      }
      if (rawArgs.dailyOnly && rawArgs.weeklyOnly) {
        errors.push("daily-only and weekly-only cannot be combined");
      }
      break;

    case "full":
      // full mode allows any combination that reports allows
      if (rawArgs.configOnly && rawArgs.cleanup) {
        errors.push("config-only cannot be combined with cleanup");
      }
      if (rawArgs.configOnly && rawArgs.dailyOnly) {
        errors.push("config-only cannot be combined with daily-only");
      }
      if (rawArgs.configOnly && rawArgs.weeklyOnly) {
        errors.push("config-only cannot be combined with weekly-only");
      }
      if (rawArgs.dailyOnly && rawArgs.weeklyOnly) {
        errors.push("daily-only and weekly-only cannot be combined");
      }
      break;
  }

  if (errors.length > 0) {
    return { ok: false, error: errors.join("; ") };
  }

  const args: DiagnosticsArgs = {
    mode,
    runCollection: rawArgs.runCollection,
    configOnly: rawArgs.configOnly,
    dailyOnly: rawArgs.dailyOnly,
    weeklyOnly: rawArgs.weeklyOnly,
    cleanup: rawArgs.cleanup,
    allowWrite: rawArgs.allowWrite,
    confirmProduction: rawArgs.confirmProduction,
    confirmCleanup: rawArgs.confirmCleanup,
  };

  return { ok: true, args };
}

export interface DeriveRiskLevelOptions {
  runCollection?: boolean;
  cleanup?: boolean;
  configOnly?: boolean;
  dailyOnly?: boolean;
  weeklyOnly?: boolean;
}

/**
 * Derives the risk level based on mode and options
 */
export function deriveRiskLevel(
  mode: DiagnosticsMode,
  options: DeriveRiskLevelOptions
): DiagnosticsRiskLevel {
  const { runCollection = false, cleanup = false, configOnly = false } = options;

  // Cleanup is always high-risk-write
  if (cleanup) {
    return "high-risk-write";
  }

  switch (mode) {
    case "collection":
      if (runCollection) {
        return "write";
      }
      return "read-only";

    case "reports":
      if (configOnly) {
        return "read-only";
      }
      // daily-only, weekly-only, or default reports mode
      return "write";

    case "full":
      // full defaults to write (it runs reports which may trigger writes)
      return "write";
  }
}

/**
 * Checks if the environment mismatch should block execution
 */
export function shouldBlockDueToEnvMismatch(
  effectiveEnv: DiagnosticsEnv,
  inferredEnv: DiagnosticsEnv | "unknown"
): boolean {
  // If we can't infer the environment, allow execution (trust the explicit setting)
  if (inferredEnv === "unknown") {
    return false;
  }

  // If effective and inferred don't match, block
  return effectiveEnv !== inferredEnv;
}
