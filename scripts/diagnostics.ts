#!/usr/bin/env bun

/**
 * Diagnostics Framework CLI
 *
 * Unified entry point for running diagnostics in collection, reports, or full mode.
 *
 * Usage:
 *   bun scripts/diagnostics.ts <mode> [options]
 *
 * Modes:
 *   collection   Run collection diagnostics (guards, health, inventory)
 *   reports      Run reports diagnostics (config, inventory, daily, weekly, integrity)
 *   full         Run full diagnostics (collection + reports)
 *
 * Options:
 *   --run-collection        Trigger actual collection run (collection mode only)
 *   --config-only           Skip report generation, only validate config API
 *   --daily-only            Only run daily report assertions
 *   --weekly-only           Only run weekly report assertions
 *   --cleanup               Clean up test data after run (DANGEROUS)
 *   --allow-write           Allow write operations in read-only modes
 *   --confirm-production    Acknowledge production environment risk
 *   --confirm-cleanup       Acknowledge data cleanup risk
 *   --api-url <url>         API URL (default: http://localhost:3000)
 *   --json-output <path>     Write JSON output to file
 *   --verbose               Enable verbose logging
 *   --help                  Show this help message
 */

import { parseArgs } from "util";
import { writeFile } from "fs/promises";
import { inferEnvFromDatabaseUrl, redactDatabaseHost, normalizeAndValidateArgs, deriveRiskLevel } from "../src/diagnostics/core/guards";
import { formatDiagnosticsRun, serializeDiagnosticsRun } from "../src/diagnostics/core/format";
import { runCollectionDiagnostics } from "../src/diagnostics/runners/collection";
import { runReportsDiagnostics } from "../src/diagnostics/runners/reports";
import { runFullDiagnostics } from "../src/diagnostics/runners/full";
import type { DiagnosticsMode, DiagnosticsArgs, DiagnosticsRunResult } from "../src/diagnostics/core/types";

// Environment variable for diagnostics environment override
const DIAGNOSTICS_ENV = process.env.DIAGNOSTICS_ENV ?? "test";
const DATABASE_URL = process.env.DATABASE_URL ?? "";
const API_URL_DEFAULT = "http://localhost:3000";

// ANSI color codes
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

function printHelp() {
  console.log(`
${BOLD}Diagnostics Framework CLI${RESET}

${CYAN}Usage:${RESET}
  bun scripts/diagnostics.ts <mode> [options]

${CYAN}Modes:${RESET}
  collection   Run collection diagnostics (guards, health, inventory)
  reports      Run reports diagnostics (config, inventory, daily, weekly, integrity)
  full         Run full diagnostics (collection + reports)

${CYAN}Options:${RESET}
  --run-collection        Trigger actual collection run (collection mode only)
  --config-only            Skip report generation, only validate config API
  --daily-only             Only run daily report assertions
  --weekly-only            Only run weekly report assertions
  --cleanup                Clean up test data after run (DANGEROUS)
  --allow-write            Allow write operations in read-only modes
  --confirm-production     Acknowledge production environment risk
  --confirm-cleanup        Acknowledge data cleanup risk
  --api-url <url>          API URL (default: ${API_URL_DEFAULT})
  --json-output <path>     Write JSON output to file
  --verbose                Enable verbose logging
  --help                   Show this help message

${CYAN}Environment Variables:${RESET}
  DIAGNOSTICS_ENV   Override environment detection (test|production)
  DATABASE_URL      Database connection URL

${CYAN}Examples:${RESET}
  # Run collection diagnostics (read-only)
  bun scripts/diagnostics.ts collection

  # Run collection with actual collection trigger
  bun scripts/diagnostics.ts collection --run-collection

  # Run reports diagnostics with daily-only
  bun scripts/diagnostics.ts reports --daily-only

  # Run full diagnostics pipeline
  bun scripts/diagnostics.ts full --confirm-production
`);
}

interface ParsedCliArgs {
  mode: DiagnosticsMode | null;
  runCollection: boolean;
  configOnly: boolean;
  dailyOnly: boolean;
  weeklyOnly: boolean;
  cleanup: boolean;
  allowWrite: boolean;
  confirmProduction: boolean;
  confirmCleanup: boolean;
  apiUrl: string;
  jsonOutput: string | null;
  verbose: boolean;
  help: boolean;
}

function parseCliArgs(args: string[]): ParsedCliArgs {
  const parsed = parseArgs({
    args,
    options: {
      "run-collection": { type: "boolean", default: false },
      "config-only": { type: "boolean", default: false },
      "daily-only": { type: "boolean", default: false },
      "weekly-only": { type: "boolean", default: false },
      cleanup: { type: "boolean", default: false },
      "allow-write": { type: "boolean", default: false },
      "confirm-production": { type: "boolean", default: false },
      "confirm-cleanup": { type: "boolean", default: false },
      "api-url": { type: "string", default: API_URL_DEFAULT },
      "json-output": { type: "string" },
      verbose: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  const positionalArgs = parsed.positionals;
  const mode = (positionalArgs[0] as DiagnosticsMode) ?? null;

  return {
    mode,
    runCollection: parsed.values["run-collection"] as boolean,
    configOnly: parsed.values["config-only"] as boolean,
    dailyOnly: parsed.values["daily-only"] as boolean,
    weeklyOnly: parsed.values["weekly-only"] as boolean,
    cleanup: parsed.values.cleanup as boolean,
    allowWrite: parsed.values["allow-write"] as boolean,
    confirmProduction: parsed.values["confirm-production"] as boolean,
    confirmCleanup: parsed.values["confirm-cleanup"] as boolean,
    apiUrl: parsed.values["api-url"] as string,
    jsonOutput: (parsed.values["json-output"] as string) ?? null,
    verbose: parsed.values.verbose as boolean,
    help: parsed.values.help as boolean,
  };
}

function printBanner(mode: DiagnosticsMode, env: string, dbHost: string, riskLevel: string) {
  const riskColor = riskLevel === "read-only" ? GREEN : riskLevel === "write" ? YELLOW : RED;
  console.log(`
${BOLD}═══════════════════════════════════════════════════════════${RESET}
${BOLD}  DIAGNOSTICS  [${mode.toUpperCase()}]${RESET}
${BOLD}═══════════════════════════════════════════════════════════${RESET}
  Mode     : ${mode}
  Env      : ${env}
  DB Host  : ${dbHost}
  Risk     : ${riskColor}${riskLevel}${RESET}
${BOLD}═══════════════════════════════════════════════════════════${RESET}
`);
}

function printRiskBanner(riskLevel: string, args: ParsedCliArgs) {
  if (riskLevel === "high-risk-write") {
    console.log(`
${RED}${BOLD}⚠️  HIGH-RISK-WRITE OPERATION${RESET}

This operation will DELETE data from the database.
${args.confirmCleanup ? GREEN + "✓ Cleanup confirmed" + RESET : RED + "✗ Cleanup NOT confirmed" + RESET}

Use --confirm-cleanup to acknowledge this risk.
`);
  } else if (riskLevel === "write") {
    console.log(`
${YELLOW}${BOLD}⚠️  WRITE OPERATION${RESET}

This operation will modify database records.
${args.confirmProduction ? GREEN + "✓ Production confirmed" + RESET : RED + "✗ Production NOT confirmed" + RESET}

Use --confirm-production to acknowledge this risk.
`);
  }
}

async function writeJsonOutput(path: string, result: DiagnosticsRunResult) {
  try {
    const json = serializeDiagnosticsRun(result);
    await writeFile(path, json, "utf-8");
    console.log(`${GREEN}✓ JSON output written to ${path}${RESET}`);
  } catch (err) {
    console.error(`${RED}✗ Failed to write JSON output: ${err instanceof Error ? err.message : String(err)}${RESET}`);
    // JSON output failure doesn't affect main result
  }
}

async function main() {
  const cliArgs = parseCliArgs(process.argv.slice(2));

  if (cliArgs.help) {
    printHelp();
    process.exit(0);
  }

  // Validate mode
  if (!cliArgs.mode) {
    console.error(`${RED}Error: mode is required (collection, reports, or full)${RESET}`);
    console.error(`Run with --help for usage information.`);
    process.exit(1);
  }

  if (!["collection", "reports", "full"].includes(cliArgs.mode)) {
    console.error(`${RED}Error: invalid mode '${cliArgs.mode}'${RESET}`);
    console.error(`Run with --help for usage information.`);
    process.exit(1);
  }

  const verbose = cliArgs.verbose;

  if (verbose) {
    console.log(`[CLI] Parsed arguments:`, JSON.stringify(cliArgs, null, 2));
  }

  // ── Step 1: Validate arguments with normalizeAndValidateArgs ─────────────
  const normalizeResult = normalizeAndValidateArgs(cliArgs.mode, {
    runCollection: cliArgs.runCollection,
    configOnly: cliArgs.configOnly,
    dailyOnly: cliArgs.dailyOnly,
    weeklyOnly: cliArgs.weeklyOnly,
    cleanup: cliArgs.cleanup,
    allowWrite: cliArgs.allowWrite,
    confirmProduction: cliArgs.confirmProduction,
    confirmCleanup: cliArgs.confirmCleanup,
  });

  if (!normalizeResult.ok) {
    console.error(`${RED}Error: ${normalizeResult.error}${RESET}`);
    process.exit(1);
  }

  const args: DiagnosticsArgs = normalizeResult.args!;

  // ── Step 2: Environment inference ─────────────────────────────────────────
  const inferredEnv = inferEnvFromDatabaseUrl(DATABASE_URL);
  const effectiveEnv = DIAGNOSTICS_ENV as "test" | "production";
  const dbHost = redactDatabaseHost(DATABASE_URL);

  if (verbose) {
    console.log(`[CLI] effectiveEnv=${effectiveEnv}, inferredEnv=${inferredEnv}, dbHost=${dbHost}`);
  }

  // ── Step 3: Derive risk level ────────────────────────────────────────────
  const riskLevel = deriveRiskLevel(cliArgs.mode, {
    runCollection: cliArgs.runCollection,
    cleanup: cliArgs.cleanup,
    configOnly: cliArgs.configOnly,
    dailyOnly: cliArgs.dailyOnly,
    weeklyOnly: cliArgs.weeklyOnly,
  });

  if (verbose) {
    console.log(`[CLI] riskLevel=${riskLevel}`);
  }

  // ── Step 4: Production write confirmation check ──────────────────────────
  if (riskLevel === "high-risk-write" && !cliArgs.confirmCleanup) {
    console.error(`${RED}Error: --confirm-cleanup is required for high-risk-write operations${RESET}`);
    process.exit(1);
  }

  if (riskLevel === "write" && effectiveEnv === "production" && !cliArgs.confirmProduction) {
    console.error(`${RED}Error: --confirm-production is required for production environment${RESET}`);
    process.exit(1);
  }

  // ── Step 5: Print pre-run banner ─────────────────────────────────────────
  printBanner(cliArgs.mode, effectiveEnv, dbHost, riskLevel);
  printRiskBanner(riskLevel, cliArgs);

  // ── Step 6: Execute appropriate runner ───────────────────────────────────
  let result: DiagnosticsRunResult;

  try {
    switch (cliArgs.mode) {
      case "collection":
        result = (await runCollectionDiagnostics({
          args,
          effectiveEnv,
          dbHost,
          verbose,
        })).result;
        break;

      case "reports":
        result = await runReportsDiagnostics({
          args,
          effectiveEnv,
          dbHost,
          apiUrl: cliArgs.apiUrl,
          verbose,
        });
        break;

      case "full":
        result = await runFullDiagnostics({
          args,
          effectiveEnv,
          inferredEnv,
          dbHost,
          apiUrl: cliArgs.apiUrl,
          verbose,
        });
        break;

      default:
        console.error(`${RED}Error: unhandled mode '${cliArgs.mode}'${RESET}`);
        process.exit(1);
    }
  } catch (err) {
    console.error(`${RED}✗ Diagnostics run failed:${RESET}`);
    console.error(err instanceof Error ? err.message : String(err));
    if (verbose && err instanceof Error && err.stack) {
      console.error(err.stack);
    }
    process.exit(1);
  }

  // ── Step 7: Output results ───────────────────────────────────────────────
  console.log(formatDiagnosticsRun(result));

  // Write JSON output if requested
  if (cliArgs.jsonOutput) {
    await writeJsonOutput(cliArgs.jsonOutput, result);
  }

  // ── Step 8: Exit with appropriate code ────────────────────────────────────
  const exitCode = result.status === "FAIL" ? 1 : 0;
  process.exit(exitCode);
}

main().catch((err) => {
  console.error(`${RED}Fatal error:${RESET}`, err);
  process.exit(1);
});
