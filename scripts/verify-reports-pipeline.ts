/**
 * Reports Pipeline 端到端验证脚本
 *
 * 通过 API 调用验证日报/周报生成全流程（生产模式）。
 *
 * 用法:
 *   npx tsx scripts/verify-reports-pipeline.ts
 *   npx tsx scripts/verify-reports-pipeline.ts --daily-only --cleanup
 *   npx tsx scripts/verify-reports-pipeline.ts --weekly-only --skip-collection
 *   npx tsx scripts/verify-reports-pipeline.ts --config-only
 *   npx tsx scripts/verify-reports-pipeline.ts --daily-packs "tech,ai" --max-items 30 --pick-count 5
 *   npx tsx scripts/verify-reports-pipeline.ts --collection-only
 *   npx tsx scripts/verify-reports-pipeline.ts --verbose --json-output results.json
 */

import { prisma } from "../lib/prisma"
import { formatUtcDate, beijingWeekRange, utcWeekNumber } from "../lib/date-utils"
import { writeFileSync } from "fs"

// ── Types ─────────────────────────────────────────────────

interface StageResult {
  stage: string
  status: "PASS" | "FAIL" | "SKIP"
  details: string
  duration: number
}

interface CliArgs {
  apiUrl: string
  skipCollection: boolean
  dailyOnly: boolean
  weeklyOnly: boolean
  collectionOnly: boolean
  cleanup: boolean
  timeout: number
  pollInterval: number
  configOnly: boolean
  verbose: boolean
  jsonOutput: string | null
  dailyPacks: string[] | null
  maxItems: number | null
  minScore: number | null
  pickCount: number | null
  keywordBlacklist: string[] | null
  weeklyDays: number | null
  weeklyPickCount: number | null
}

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

interface DailyReportData {
  date: string | null
  dayLabel: string | null
  topicCount: number
  errorMessage?: string | null
  errorSteps?: string[] | null
  topics: Array<{
    id: string
    order: number
    title: string
    summary: string
    itemIds: string[]
    tweetIds: string[]
  }>
  referencedItems: Array<{ id: string; title: string; url: string; score: number; summary: string | null }>
  referencedTweets: Array<{ id: string; text: string; authorHandle: string; tweetUrl: string }>
}

interface WeeklyReportData {
  weekNumber: string | null
  editorial: string | null
  errorMessage?: string | null
  errorSteps?: string[] | null
  picks: Array<{ id: string; order: number; itemId: string; reason: string }>
  referencedItems: Array<{ id: string; title: string; url: string; score: number; summary: string | null }>
}

interface JsonOutput {
  runId: string
  mode: string
  config: Record<string, unknown>
  results: Array<{ id: string; stage: string; status: string; duration: number; details: string }>
  summary: { total: number; passed: number; failed: number; skipped: number; duration: number }
}

// ── Utility Functions ──────────────────────────────────────

function divider(title: string) {
  console.log(`\n${"=".repeat(60)}`)
  console.log(`  ${title}`)
  console.log(`${"=".repeat(60)}\n`)
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "..." : s
}

function verboseLog(args: CliArgs, ...msgs: string[]) {
  if (args.verbose) console.log(...msgs)
}

/**
 * Poll until checkFn returns true, throw on timeout.
 */
async function pollUntil<T>(
  fetchFn: () => Promise<T>,
  checkFn: (value: T) => boolean,
  options: { timeout: number; interval: number; stageName: string },
): Promise<T> {
  const start = Date.now()
  const timeoutMs = options.timeout * 1000
  while (Date.now() - start < timeoutMs) {
    try {
      const value = await fetchFn()
      if (checkFn(value)) return value
    } catch {
      // fetchFn itself can throw on transient errors, just retry
    }
    await new Promise((r) => setTimeout(r, options.interval * 1000))
  }
  throw new Error(`${options.stageName} timed out after ${((Date.now() - start) / 1000).toFixed(1)}s`)
}

/** PUT helper with JSON body */
async function apiPut(url: string, body: unknown): Promise<{ status: number; data: unknown }> {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return { status: res.status, data }
}

/** GET helper */
async function apiGet<T = unknown>(url: string): Promise<{ status: number; body: ApiResponse<T> }> {
  const res = await fetch(url)
  const body: ApiResponse<T> = await res.json()
  return { status: res.status, body }
}

// ── CLI Argument Parsing ───────────────────────────────────

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2)
  const args: CliArgs = {
    apiUrl: "http://localhost:3000",
    skipCollection: false,
    dailyOnly: false,
    weeklyOnly: false,
    collectionOnly: false,
    cleanup: false,
    timeout: 300,
    pollInterval: 3,
    configOnly: false,
    verbose: false,
    jsonOutput: null,
    dailyPacks: null,
    maxItems: null,
    minScore: null,
    pickCount: null,
    keywordBlacklist: null,
    weeklyDays: null,
    weeklyPickCount: null,
  }

  const nextArg = (flag: string, idx: number): [string, number] => {
    const val = argv[idx + 1]
    if (val === undefined) {
      console.error(`Flag ${flag} requires a value`)
      process.exit(1)
    }
    return [val, idx + 1]
  }
  const parseIntArg = (flag: string, idx: number): [number, number] => {
    const [val, newIdx] = nextArg(flag, idx)
    const parsed = parseInt(val, 10)
    if (isNaN(parsed)) {
      console.error(`Flag ${flag} requires a number`)
      process.exit(1)
    }
    return [parsed, newIdx]
  }

  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]
    switch (flag) {
      case "--api-url": {
        const [val] = nextArg(flag, i)
        args.apiUrl = val
        i++
        break
      }
      case "--skip-collection":
        args.skipCollection = true
        break
      case "--daily-only":
        args.dailyOnly = true
        break
      case "--weekly-only":
        args.weeklyOnly = true
        break
      case "--collection-only":
        args.collectionOnly = true
        break
      case "--cleanup":
        args.cleanup = true
        break
      case "--timeout": {
        const [val] = parseIntArg(flag, i)
        args.timeout = val
        i++
        break
      }
      case "--poll-interval": {
        const [val] = parseIntArg(flag, i)
        args.pollInterval = val
        i++
        break
      }
      case "--config-only":
        args.configOnly = true
        break
      case "--verbose":
        args.verbose = true
        break
      case "--json-output": {
        const [val] = nextArg(flag, i)
        args.jsonOutput = val
        i++
        break
      }
      case "--daily-packs": {
        const [val] = nextArg(flag, i)
        args.dailyPacks = val.split(",").map((s) => s.trim())
        i++
        break
      }
      case "--max-items": {
        const [val] = parseIntArg(flag, i)
        args.maxItems = val
        i++
        break
      }
      case "--min-score": {
        const [val] = parseIntArg(flag, i)
        args.minScore = val
        i++
        break
      }
      case "--pick-count": {
        const [val] = parseIntArg(flag, i)
        args.pickCount = val
        i++
        break
      }
      case "--keyword-blacklist": {
        const [val] = nextArg(flag, i)
        args.keywordBlacklist = val.split(",").map((s) => s.trim())
        i++
        break
      }
      case "--weekly-days": {
        const [val] = parseIntArg(flag, i)
        args.weeklyDays = val
        i++
        break
      }
      case "--weekly-pick-count": {
        const [val] = parseIntArg(flag, i)
        args.weeklyPickCount = val
        i++
        break
      }
      default:
        console.error(`Unknown flag: ${flag}`)
        process.exit(1)
    }
  }

  return args
}

// ── Stage 0: Parse Args + Pre-checks ──────────────────────

async function runStage0(args: CliArgs): Promise<StageResult> {
  const start = Date.now()
  divider("STAGE 0: Parse args + pre-checks")

  const errors: string[] = []

  // Test dev server
  try {
    const res = await fetch(`${args.apiUrl}/api/daily`)
    if (!res.ok) {
      errors.push(`dev server returned ${res.status}`)
    } else {
      console.log(`  [OK] dev server: ${args.apiUrl} (status ${res.status})`)
    }
  } catch (err) {
    errors.push(`dev server unreachable: ${err instanceof Error ? err.message : String(err)}`)
  }

  // Test DB
  try {
    await prisma.$queryRaw`SELECT 1`
    console.log(`  [OK] database: connected`)
  } catch (err) {
    errors.push(`database error: ${err instanceof Error ? err.message : String(err)}`)
  }

  // Print effective config
  console.log(`\n  Effective config:`)
  console.log(`    api-url:         ${args.apiUrl}`)
  console.log(`    skip-collection: ${args.skipCollection}`)
  console.log(`    daily-only:      ${args.dailyOnly}`)
  console.log(`    weekly-only:     ${args.weeklyOnly}`)
  console.log(`    collection-only: ${args.collectionOnly}`)
  console.log(`    cleanup:         ${args.cleanup}`)
  console.log(`    timeout:         ${args.timeout}s`)
  console.log(`    poll-interval:   ${args.pollInterval}s`)
  console.log(`    config-only:     ${args.configOnly}`)
  console.log(`    verbose:         ${args.verbose}`)
  if (args.jsonOutput) console.log(`    json-output:     ${args.jsonOutput}`)
  if (args.dailyPacks) console.log(`    daily-packs:     ${args.dailyPacks.join(", ")}`)
  if (args.maxItems !== null) console.log(`    max-items:       ${args.maxItems}`)
  if (args.minScore !== null) console.log(`    min-score:       ${args.minScore}`)
  if (args.pickCount !== null) console.log(`    pick-count:      ${args.pickCount}`)
  if (args.keywordBlacklist) console.log(`    keyword-bl:      ${args.keywordBlacklist.join(", ")}`)
  if (args.weeklyDays !== null) console.log(`    weekly-days:     ${args.weeklyDays}`)
  if (args.weeklyPickCount !== null) console.log(`    weekly-pick-cnt: ${args.weeklyPickCount}`)

  if (errors.length > 0) {
    return { stage: "Pre-checks", status: "FAIL", details: errors.join("; "), duration: Date.now() - start }
  }

  return { stage: "Pre-checks", status: "PASS", details: "dev server OK, DB OK", duration: Date.now() - start }
}

// ── Stage 1: Config Management ────────────────────────────

async function runStage1(args: CliArgs): Promise<StageResult> {
  const start = Date.now()
  divider("STAGE 1: Config management")

  try {
    // GET current config
    const getRes = await fetch(`${args.apiUrl}/api/settings/reports`)
    if (!getRes.ok) {
      return { stage: "Config", status: "FAIL", details: `GET /api/settings/reports returned ${getRes.status}`, duration: Date.now() - start }
    }

    const getBody: ApiResponse<{ daily: Record<string, unknown>; weekly: Record<string, unknown> }> = await getRes.json()
    if (!getBody.success || !getBody.data) {
      return { stage: "Config", status: "FAIL", details: `GET response: ${JSON.stringify(getBody)}`, duration: Date.now() - start }
    }

    const originalConfig = getBody.data
    console.log("  Current config:")
    console.log(`    Daily:  packs=${JSON.stringify(originalConfig.daily.packs)}, maxItems=${originalConfig.daily.maxItems}, pickCount=${originalConfig.daily.pickCount}`)
    console.log(`    Weekly: days=${originalConfig.weekly.days}, pickCount=${originalConfig.weekly.pickCount}`)

    // Validate --daily-packs against DB
    if (args.dailyPacks && args.dailyPacks.length > 0) {
      const packs = await prisma.pack.findMany({ select: { id: true, name: true } })
      const packMap = new Map(packs.map((p) => [p.name, p.id]))
      console.log(`\n  Available packs: ${packs.map((p) => p.name).join(", ") || "(none)"}`)

      const invalidPacks = args.dailyPacks.filter((name) => !packMap.has(name))
      if (invalidPacks.length > 0) {
        return {
          stage: "Config",
          status: "FAIL",
          details: `Invalid daily-packs: ${invalidPacks.join(", ")} (not found in DB)`,
          duration: Date.now() - start,
        }
      }

      console.log(`  [OK] All daily-packs valid: ${args.dailyPacks.join(", ")}`)
    }

    // Resolve pack names → IDs (config stores pack IDs, not names)
    let resolvedPackIds: string[] | null = null
    if (args.dailyPacks && args.dailyPacks.length > 0) {
      const packs = await prisma.pack.findMany({
        where: { name: { in: args.dailyPacks } },
        select: { id: true, name: true },
      })
      resolvedPackIds = packs.map((p) => p.id)
      console.log(`  Resolved pack IDs: ${resolvedPackIds.join(", ")}`)
    }

    // Build update payload
    const hasUpdates =
      resolvedPackIds ||
      args.maxItems !== null ||
      args.minScore !== null ||
      args.pickCount !== null ||
      args.keywordBlacklist ||
      args.weeklyDays !== null ||
      args.weeklyPickCount !== null

    if (hasUpdates) {
      const payload: Record<string, Record<string, unknown>> = {}

      const dailyUpdate: Record<string, unknown> = {}
      if (resolvedPackIds) dailyUpdate.packs = resolvedPackIds
      if (args.maxItems !== null) dailyUpdate.maxItems = args.maxItems
      if (args.minScore !== null) dailyUpdate.minScore = args.minScore
      if (args.pickCount !== null) dailyUpdate.pickCount = args.pickCount
      if (args.keywordBlacklist) dailyUpdate.keywordBlacklist = args.keywordBlacklist
      if (Object.keys(dailyUpdate).length > 0) payload.daily = dailyUpdate

      const weeklyUpdate: Record<string, unknown> = {}
      if (args.weeklyDays !== null) weeklyUpdate.days = args.weeklyDays
      if (args.weeklyPickCount !== null) weeklyUpdate.pickCount = args.weeklyPickCount
      if (Object.keys(weeklyUpdate).length > 0) payload.weekly = weeklyUpdate

      console.log(`\n  Updating config with: ${JSON.stringify(payload, null, 4).split("\n").join("\n  ")}`)

      const putRes = await fetch(`${args.apiUrl}/api/settings/reports`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!putRes.ok) {
        const putBody = await putRes.text()
        return { stage: "Config", status: "FAIL", details: `PUT returned ${putRes.status}: ${putBody}`, duration: Date.now() - start }
      }

      console.log(`  [OK] Config updated (status ${putRes.status})`)

      // Print final config
      const finalGetRes = await fetch(`${args.apiUrl}/api/settings/reports`)
      const finalBody: ApiResponse<{ daily: Record<string, unknown>; weekly: Record<string, unknown> }> = await finalGetRes.json()
      if (finalBody.success && finalBody.data) {
        console.log(`\n  Final config:`)
        console.log(`    Daily:  packs=${JSON.stringify(finalBody.data.daily.packs)}, maxItems=${finalBody.data.daily.maxItems}, pickCount=${finalBody.data.daily.pickCount}`)
        console.log(`    Weekly: days=${finalBody.data.weekly.days}, pickCount=${finalBody.data.weekly.pickCount}`)
      }
    } else {
      console.log(`\n  No config updates requested, keeping current config`)
    }

    return { stage: "Config", status: "PASS", details: hasUpdates ? "config updated" : "config unchanged", duration: Date.now() - start }
  } catch (err) {
    return { stage: "Config", status: "FAIL", details: err instanceof Error ? err.message : String(err), duration: Date.now() - start }
  }
}

// ── Stage 2: DB Data Inventory ────────────────────────────

async function runStage2(args: CliArgs): Promise<StageResult> {
  const start = Date.now()
  divider("STAGE 2: DB data inventory")

  try {
    const now24hAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const [itemCount, tweetCount, dailyCount, weeklyCount] = await Promise.all([
      prisma.item.count({ where: { publishedAt: { gte: now24hAgo } } }),
      prisma.tweet.count({ where: { publishedAt: { gte: now24hAgo }, tab: { in: ["home", "lists"] } } }),
      prisma.dailyOverview.count(),
      prisma.weeklyReport.count(),
    ])

    console.log(`  Items (publishedAt >= 24h ago): ${itemCount}`)
    console.log(`  Tweets (publishedAt >= 24h ago, home/lists): ${tweetCount}`)
    console.log(`  DailyOverview records: ${dailyCount}`)
    console.log(`  WeeklyReport records: ${weeklyCount}`)

    // If --daily-packs specified, show item count for those packs
    if (args.dailyPacks && args.dailyPacks.length > 0) {
      const packs = await prisma.pack.findMany({
        where: { name: { in: args.dailyPacks } },
        select: { id: true, name: true },
      })
      const packIds = packs.map((p) => p.id)

      if (packIds.length > 0) {
        const packItemCount = await prisma.item.count({
          where: {
            publishedAt: { gte: now24hAgo },
            source: { packId: { in: packIds } },
          },
        })
        console.log(`\n  Items for packs [${args.dailyPacks.join(", ")}] (24h): ${packItemCount}`)
      }
    }

    const details = `items=${itemCount}, tweets=${tweetCount}, daily=${dailyCount}, weekly=${weeklyCount}`
    return { stage: "Data inventory", status: "PASS", details, duration: Date.now() - start }
  } catch (err) {
    return { stage: "Data inventory", status: "FAIL", details: err instanceof Error ? err.message : String(err), duration: Date.now() - start }
  }
}

// ── Stage 3: Cleanup ──────────────────────────────────────

async function runStage3(): Promise<StageResult> {
  const start = Date.now()
  divider("STAGE 3: Cleanup report tables")

  try {
    // ⚠️ This deletes ALL report data, not just today's
    console.log("  ⚠️  注意：将删除所有日报和周报数据（不限日期）")

    // Delete in FK order using idiomatic Prisma
    const counts: Array<{ table: string; count: number }> = []

    const weeklyPickCount = await prisma.weeklyPick.count()
    if (weeklyPickCount > 0) {
      await prisma.weeklyPick.deleteMany()
      counts.push({ table: "WeeklyPick", count: weeklyPickCount })
    }

    const weeklyReportCount = await prisma.weeklyReport.count()
    if (weeklyReportCount > 0) {
      await prisma.weeklyReport.deleteMany()
      counts.push({ table: "WeeklyReport", count: weeklyReportCount })
    }

    const digestTopicCount = await prisma.digestTopic.count()
    if (digestTopicCount > 0) {
      await prisma.digestTopic.deleteMany()
      counts.push({ table: "DigestTopic", count: digestTopicCount })
    }

    const dailyOverviewCount = await prisma.dailyOverview.count()
    if (dailyOverviewCount > 0) {
      await prisma.dailyOverview.deleteMany()
      counts.push({ table: "DailyOverview", count: dailyOverviewCount })
    }

    if (counts.length === 0) {
      console.log("  Nothing to clean")
      return { stage: "Cleanup", status: "PASS", details: "nothing to clean", duration: Date.now() - start }
    }

    for (const c of counts) {
      console.log(`  Deleted ${c.table}: ${c.count} rows`)
    }

    return { stage: "Cleanup", status: "PASS", details: `deleted ${counts.length} tables`, duration: Date.now() - start }
  } catch (err) {
    return { stage: "Cleanup", status: "FAIL", details: err instanceof Error ? err.message : String(err), duration: Date.now() - start }
  }
}

// ── Stage 4: Trigger Collection ───────────────────────────

async function runStage4(args: CliArgs): Promise<StageResult> {
  const start = Date.now()
  divider("STAGE 4: Trigger collection")

  try {
    const beforeCount = await prisma.item.count()
    console.log(`  Items before collection: ${beforeCount}`)

    const res = await fetch(`${args.apiUrl}/api/cron/collect`, { method: "POST" })
    if (res.status !== 202) {
      return {
        stage: "Collection",
        status: "FAIL",
        details: `POST /api/cron/collect returned ${res.status} (expected 202)`,
        duration: Date.now() - start,
      }
    }
    console.log(`  [OK] Collect job triggered (status 202)`)

    // Poll for new items
    try {
      await pollUntil(
        () => prisma.item.count(),
        (count) => count > beforeCount,
        { timeout: args.timeout, interval: args.pollInterval, stageName: "Collection" },
      )

      const afterCount = await prisma.item.count()
      console.log(`  [OK] Items after collection: ${afterCount} (+${afterCount - beforeCount})`)
      return { stage: "Collection", status: "PASS", details: `+${afterCount - beforeCount} items`, duration: Date.now() - start }
    } catch (err) {
      console.warn(`  [WARN] ${(err instanceof Error ? err.message : String(err))}`)
      console.warn(`  [WARN] 轮询超时，请检查 dev server 日志`)
      const afterCount = await prisma.item.count()
      console.log(`  Items now: ${afterCount} (before: ${beforeCount})`)

      if (afterCount === beforeCount) {
        return { stage: "Collection", status: "FAIL", details: "no new items collected", duration: Date.now() - start }
      }

      return { stage: "Collection", status: "PASS", details: `+${afterCount - beforeCount} items (with warnings)`, duration: Date.now() - start }
    }
  } catch (err) {
    return { stage: "Collection", status: "FAIL", details: err instanceof Error ? err.message : String(err), duration: Date.now() - start }
  }
}

// ── Stage 5: Trigger Daily Report ─────────────────────────

async function runStage5(args: CliArgs): Promise<StageResult> {
  const start = Date.now()
  divider("STAGE 5: Trigger daily report")

  try {
    // Check if 24h items exist
    const now24hAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recentItemCount = await prisma.item.count({ where: { publishedAt: { gte: now24hAgo } } })

    if (recentItemCount === 0) {
      console.log("  [SKIP] No items in the past 24 hours")
      return { stage: "Daily report", status: "SKIP", details: "no items in past 24h", duration: Date.now() - start }
    }

    console.log(`  Found ${recentItemCount} items in the past 24 hours`)

    // Trigger daily report
    const res = await fetch(`${args.apiUrl}/api/cron/daily`, { method: "POST" })
    if (!res.ok) {
      return {
        stage: "Daily report",
        status: "FAIL",
        details: `POST /api/cron/daily returned ${res.status}`,
        duration: Date.now() - start,
      }
    }
    console.log(`  [OK] Daily report job triggered (status ${res.status})`)

    // Compute target date
    const targetDate = formatUtcDate(new Date())
    console.log(`  Target date: ${targetDate}`)

    // Poll for DailyOverview
    try {
      await pollUntil(
        () => prisma.dailyOverview.findUnique({ where: { date: targetDate } }),
        (overview) => overview !== null,
        { timeout: args.timeout, interval: args.pollInterval, stageName: "Daily report generation" },
      )

      console.log(`  [OK] DailyOverview created for ${targetDate}`)
      return { stage: "Daily report", status: "PASS", details: `generated for ${targetDate}`, duration: Date.now() - start }
    } catch (err) {
      console.warn(`  [WARN] ${(err instanceof Error ? err.message : String(err))}`)
      console.warn(`  [WARN] 轮询超时，请检查 dev server 日志`)
      return { stage: "Daily report", status: "FAIL", details: "generation timed out", duration: Date.now() - start }
    }
  } catch (err) {
    return { stage: "Daily report", status: "FAIL", details: err instanceof Error ? err.message : String(err), duration: Date.now() - start }
  }
}

// ── Stage 6: Verify Daily Report ──────────────────────────

async function runStage6(args: CliArgs): Promise<StageResult> {
  const start = Date.now()
  divider("STAGE 6: Verify daily report")

  try {
    const targetDate = formatUtcDate(new Date())

    // --- API check ---
    const apiRes = await fetch(`${args.apiUrl}/api/daily?date=${targetDate}`)
    if (!apiRes.ok) {
      return { stage: "Daily verify", status: "FAIL", details: `GET /api/daily returned ${apiRes.status}`, duration: Date.now() - start }
    }

    const apiBody: ApiResponse<DailyReportData> = await apiRes.json()
    if (!apiBody.success || !apiBody.data) {
      return { stage: "Daily verify", status: "FAIL", details: `API response: ${JSON.stringify(apiBody)}`, duration: Date.now() - start }
    }

    const dailyData = apiBody.data
    console.log(`  API check:`)
    console.log(`    date:      ${dailyData.date}`)
    console.log(`    dayLabel:  ${dailyData.dayLabel}`)
    console.log(`    topics:    ${dailyData.topics.length}`)
    console.log(`    refItems:  ${dailyData.referencedItems.length}`)
    console.log(`    refTweets: ${dailyData.referencedTweets.length}`)

    if (dailyData.topics.length === 0) {
      return { stage: "Daily verify", status: "FAIL", details: "empty report: no topics", duration: Date.now() - start }
    }

    // --- DB check ---
    const overview = await prisma.dailyOverview.findUnique({
      where: { date: targetDate },
      include: {
        topics: { orderBy: { order: "asc" } },
      },
    })

    if (!overview) {
      return { stage: "Daily verify", status: "FAIL", details: `DailyOverview not found for ${targetDate}`, duration: Date.now() - start }
    }

    console.log(`\n  DB check:`)
    console.log(`    topicCount (stored): ${overview.topicCount}`)
    console.log(`    topics (actual):     ${overview.topics.length}`)

    const errors: string[] = []

    // Validate topicCount
    if (overview.topicCount !== overview.topics.length) {
      errors.push(`topicCount mismatch: stored=${overview.topicCount}, actual=${overview.topics.length}`)
    }

    // Validate topics
    for (const topic of overview.topics) {
      if (!topic.title || topic.title.trim() === "") {
        errors.push(`topic ${topic.id}: empty title`)
      }
      if (!topic.summary || topic.summary.trim() === "") {
        errors.push(`topic ${topic.id}: empty summary`)
      }
      if (topic.itemIds.length === 0 && topic.tweetIds.length === 0) {
        errors.push(`topic ${topic.id}: no itemIds or tweetIds`)
      }
    }

    // Full reference integrity: check ALL itemIds
    const allItemIds = new Set<string>()
    const allTweetIds = new Set<string>()
    for (const topic of overview.topics) {
      for (const id of topic.itemIds) allItemIds.add(id)
      for (const id of topic.tweetIds) allTweetIds.add(id)
    }

    if (allItemIds.size > 0) {
      const existingItemCount = await prisma.item.count({
        where: { id: { in: Array.from(allItemIds) } },
      })
      const missingItemCount = allItemIds.size - existingItemCount
      if (missingItemCount > 0) {
        errors.push(`FK integrity: ${missingItemCount}/${allItemIds.size} itemIds not found in Item table`)
      } else {
        console.log(`    ref integrity:    OK (${allItemIds.size} item IDs verified)`)
      }
    }

    if (allTweetIds.size > 0) {
      const existingTweetCount = await prisma.tweet.count({
        where: { id: { in: Array.from(allTweetIds) } },
      })
      const missingTweetCount = allTweetIds.size - existingTweetCount
      if (missingTweetCount > 0) {
        errors.push(`FK integrity: ${missingTweetCount}/${allTweetIds.size} tweetIds not found in Tweet table`)
      } else {
        console.log(`    ref integrity:    OK (${allTweetIds.size} tweet IDs verified)`)
      }
    }

    // If --daily-packs: verify sourceId -> Source.packId in packs
    if (args.dailyPacks && args.dailyPacks.length > 0 && allItemIds.size > 0) {
      const packs = await prisma.pack.findMany({
        where: { name: { in: args.dailyPacks } },
        select: { id: true, name: true },
      })
      const allowedPackIds = new Set(packs.map((p) => p.id))

      const itemsWithSource = await prisma.item.findMany({
        where: { id: { in: Array.from(allItemIds) } },
        select: { id: true, sourceId: true },
      })

      const sourceIds = itemsWithSource.map((i) => i.sourceId)
      const sources = await prisma.source.findMany({
        where: { id: { in: sourceIds } },
        select: { id: true, packId: true },
      })
      const sourcePackMap = new Map(sources.map((s) => [s.id, s.packId]))

      let mismatchCount = 0
      for (const item of itemsWithSource) {
        const packId = sourcePackMap.get(item.sourceId)
        if (!packId || !allowedPackIds.has(packId)) {
          mismatchCount++
        }
      }

      if (mismatchCount > 0) {
        errors.push(`pack filter: ${mismatchCount} items not from specified packs`)
      } else {
        console.log(`    pack filter:      OK (all items from [${args.dailyPacks.join(", ")}])`)
      }
    }

    // D-13: Picks should not overlap with topic itemIds
    const topicItemIds = new Set<string>()
    for (const topic of overview.topics) {
      for (const id of topic.itemIds) topicItemIds.add(id)
    }

    if (errors.length > 0) {
      console.log(`\n  Errors:`)
      for (const e of errors) {
        console.log(`    [FAIL] ${e}`)
      }
      return { stage: "Daily verify", status: "FAIL", details: `${errors.length} error(s)`, duration: Date.now() - start }
    }

    return {
      stage: "Daily verify",
      status: "PASS",
      details: `${overview.topics.length} topics`,
      duration: Date.now() - start,
    }
  } catch (err) {
    return { stage: "Daily verify", status: "FAIL", details: err instanceof Error ? err.message : String(err), duration: Date.now() - start }
  }
}

// ── Stage 7: Trigger Weekly Report ────────────────────────

async function runStage7(args: CliArgs): Promise<StageResult> {
  const start = Date.now()
  divider("STAGE 7: Trigger weekly report")

  try {
    // Check if we have enough DailyOverview records
    const dailyCount = await prisma.dailyOverview.count()
    if (dailyCount < 3) {
      console.log(`  [SKIP] Only ${dailyCount} DailyOverview records (need >= 3)`)
      return { stage: "Weekly report", status: "SKIP", details: `only ${dailyCount} daily overviews (need >= 3)`, duration: Date.now() - start }
    }

    console.log(`  Found ${dailyCount} DailyOverview records`)

    // Trigger weekly report
    const res = await fetch(`${args.apiUrl}/api/cron/weekly`, { method: "POST" })
    if (!res.ok) {
      return {
        stage: "Weekly report",
        status: "FAIL",
        details: `POST /api/cron/weekly returned ${res.status}`,
        duration: Date.now() - start,
      }
    }
    console.log(`  [OK] Weekly report job triggered (status ${res.status})`)

    // Compute week number
    const { start: monday } = beijingWeekRange(new Date())
    const weekNumber = utcWeekNumber(monday)
    console.log(`  Target week: ${weekNumber}`)

    // Poll for WeeklyReport
    try {
      await pollUntil(
        () => prisma.weeklyReport.findUnique({ where: { weekNumber } }),
        (report) => report !== null,
        { timeout: args.timeout, interval: args.pollInterval, stageName: "Weekly report generation" },
      )

      console.log(`  [OK] WeeklyReport created for ${weekNumber}`)
      return { stage: "Weekly report", status: "PASS", details: `generated for ${weekNumber}`, duration: Date.now() - start }
    } catch (err) {
      console.warn(`  [WARN] ${(err instanceof Error ? err.message : String(err))}`)
      console.warn(`  [WARN] 轮询超时，请检查 dev server 日志`)
      return { stage: "Weekly report", status: "FAIL", details: "generation timed out", duration: Date.now() - start }
    }
  } catch (err) {
    return { stage: "Weekly report", status: "FAIL", details: err instanceof Error ? err.message : String(err), duration: Date.now() - start }
  }
}

// ── Stage 8: Verify Weekly Report ─────────────────────────

async function runStage8(args: CliArgs): Promise<StageResult> {
  const start = Date.now()
  divider("STAGE 8: Verify weekly report")

  try {
    // Compute week number
    const { start: monday } = beijingWeekRange(new Date())
    const weekNumber = utcWeekNumber(monday)
    console.log(`  Target week: ${weekNumber}`)

    // --- API check ---
    const apiRes = await fetch(`${args.apiUrl}/api/weekly?week=${weekNumber}`)
    if (!apiRes.ok) {
      return { stage: "Weekly verify", status: "FAIL", details: `GET /api/weekly returned ${apiRes.status}`, duration: Date.now() - start }
    }

    const apiBody: ApiResponse<WeeklyReportData> = await apiRes.json()
    if (!apiBody.success || !apiBody.data) {
      return { stage: "Weekly verify", status: "FAIL", details: `API response: ${JSON.stringify(apiBody)}`, duration: Date.now() - start }
    }

    const weeklyData = apiBody.data
    console.log(`  API check:`)
    console.log(`    weekNumber:     ${weeklyData.weekNumber}`)
    console.log(`    editorial:      ${weeklyData.editorial ? truncate(weeklyData.editorial, 60) : "(null)"}`)
    console.log(`    picks:          ${weeklyData.picks.length}`)
    console.log(`    refItems:       ${weeklyData.referencedItems.length}`)

    // --- DB check ---
    const report = await prisma.weeklyReport.findUnique({
      where: { weekNumber },
      include: { picks: { orderBy: { order: "asc" } } },
    })

    if (!report) {
      return { stage: "Weekly verify", status: "FAIL", details: `WeeklyReport not found for ${weekNumber}`, duration: Date.now() - start }
    }

    const errors: string[] = []

    console.log(`\n  DB check:`)

    // Validate editorial
    if (!report.editorial || report.editorial.trim() === "") {
      errors.push("editorial is empty")
    } else {
      console.log(`    editorial:      ${report.editorial.length} chars`)
    }

    // Validate picks
    console.log(`    picks:          ${report.picks.length}`)

    for (const pick of report.picks) {
      if (!pick.itemId) {
        errors.push(`pick ${pick.id}: no itemId`)
      }
      if (!pick.reason || pick.reason.trim() === "") {
        errors.push(`pick ${pick.id}: empty reason`)
      }
    }

    // Full reference integrity: check ALL itemIds
    const itemIdSet = new Set(report.picks.map((p) => p.itemId))
    if (itemIdSet.size > 0) {
      const existingItemCount = await prisma.item.count({
        where: { id: { in: Array.from(itemIdSet) } },
      })
      const missingCount = itemIdSet.size - existingItemCount
      if (missingCount > 0) {
        errors.push(`FK integrity: ${missingCount}/${itemIdSet.size} itemIds not found in Item table`)
      } else {
        console.log(`    ref integrity:  OK (${itemIdSet.size} item IDs verified)`)
      }
    }

    if (errors.length > 0) {
      console.log(`\n  Errors:`)
      for (const e of errors) {
        console.log(`    [FAIL] ${e}`)
      }
      return { stage: "Weekly verify", status: "FAIL", details: `${errors.length} error(s)`, duration: Date.now() - start }
    }

    return {
      stage: "Weekly verify",
      status: "PASS",
      details: `${report.picks.length} picks, editorial=${report.editorial?.length ?? 0} chars`,
      duration: Date.now() - start,
    }
  } catch (err) {
    return { stage: "Weekly verify", status: "FAIL", details: err instanceof Error ? err.message : String(err), duration: Date.now() - start }
  }
}

// ═══════════════════════════════════════════════════════════
// Extended Validation Tests (P0 + P1)
// ═══════════════════════════════════════════════════════════

// ── Config Validation Tests (B-04, B-05, B-06, B-08) ──────

async function testConfigValidation(args: CliArgs): Promise<StageResult[]> {
  const start = Date.now()
  divider("TEST: Config validation (B-04, B-05, B-06, B-08)")
  const results: StageResult[] = []

  const url = `${args.apiUrl}/api/settings/reports`

  // B-04: Invalid daily params
  {
    const cases = [
      { body: { daily: { maxItems: 999 } }, label: "maxItems=999 (>200)" },
      { body: { daily: { minScore: -1 } }, label: "minScore=-1 (<0)" },
      { body: { daily: { pickCount: 0 } }, label: "pickCount=0 (<1)" },
    ]
    let allRejected = true
    for (const c of cases) {
      const { status, data } = await apiPut(url, c.body)
      const rejected = status === 400
      if (!rejected) allRejected = false
      verboseLog(args, `  B-04 ${c.label}: status=${status} ${rejected ? "REJECTED ✓" : "NOT REJECTED ✗"}`)
    }
    results.push({
      stage: "B-04 Config validation",
      status: allRejected ? "PASS" : "FAIL",
      details: allRejected ? "all invalid daily params rejected" : "some invalid params accepted",
      duration: Date.now() - start,
    })
  }

  // B-05: Weekly days not multiple of 7
  {
    const { status } = await apiPut(url, { weekly: { days: 10 } })
    const rejected = status === 400
    verboseLog(args, `  B-05 days=10 (not 7x): status=${status} ${rejected ? "REJECTED ✓" : "NOT REJECTED ✗"}`)
    results.push({
      stage: "B-05 Weekly days validation",
      status: rejected ? "PASS" : "FAIL",
      details: rejected ? "days=10 rejected" : "days=10 not rejected",
      duration: Date.now() - start,
    })
  }

  // B-06: Malformed JSON body
  {
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    })
    const rejected = res.status === 400
    verboseLog(args, `  B-06 malformed JSON: status=${res.status} ${rejected ? "REJECTED ✓" : "NOT REJECTED ✗"}`)
    results.push({
      stage: "B-06 Malformed body",
      status: rejected ? "PASS" : "FAIL",
      details: rejected ? "malformed JSON rejected" : "malformed JSON not rejected",
      duration: Date.now() - start,
    })
  }

  // B-08: Nullable prompt fields
  {
    const { status, data } = await apiPut(url, { daily: { filterPrompt: "Only AI content", topicPrompt: null } })
    if (status === 200) {
      const resp = data as { success: boolean; data: { daily: { filterPrompt: string | null; topicPrompt: string | null } } }
      const ok = resp.data?.daily?.filterPrompt === "Only AI content" && resp.data?.daily?.topicPrompt === null
      verboseLog(args, `  B-08 nullable prompts: filterPrompt="${resp.data?.daily?.filterPrompt}", topicPrompt=${resp.data?.daily?.topicPrompt} ${ok ? "✓" : "✗"}`)
      results.push({
        stage: "B-08 Nullable prompts",
        status: ok ? "PASS" : "FAIL",
        details: ok ? "nullable fields work correctly" : "nullable fields mismatch",
        duration: Date.now() - start,
      })
    } else {
      results.push({
        stage: "B-08 Nullable prompts",
        status: "FAIL",
        details: `PUT returned ${status}`,
        duration: Date.now() - start,
      })
    }
  }

  return results
}

// ── Empty Data API Tests (D-17, E-10, G-05, G-06) ───────

async function testEmptyDataApi(args: CliArgs): Promise<StageResult[]> {
  const start = Date.now()
  divider("TEST: Empty data API responses (D-17, E-10, G-05, G-06)")
  const results: StageResult[] = []

  // D-17: Daily report for non-existent date
  {
    const { status, body } = await apiGet<DailyReportData>(`${args.apiUrl}/api/daily?date=2099-01-01`)
    const ok = status === 200 && body.success === true && body.data?.topics?.length === 0
    verboseLog(args, `  D-17 empty date: status=${status}, success=${body.success}, topics=${body.data?.topics?.length}`)
    results.push({
      stage: "D-17 Empty daily API",
      status: ok ? "PASS" : "FAIL",
      details: ok ? "returns 200 with empty arrays" : `unexpected response (status=${status})`,
      duration: Date.now() - start,
    })
  }

  // E-10: Weekly report for non-existent week
  {
    const { status, body } = await apiGet<WeeklyReportData>(`${args.apiUrl}/api/weekly?week=2099-W01`)
    const ok = status === 200 && body.success === true && body.data?.picks?.length === 0 && body.data?.editorial === null
    verboseLog(args, `  E-10 empty week: status=${status}, success=${body.success}, editorial=${body.data?.editorial}`)
    results.push({
      stage: "E-10 Empty weekly API",
      status: ok ? "PASS" : "FAIL",
      details: ok ? "returns 200 with empty data" : `unexpected response (status=${status})`,
      duration: Date.now() - start,
    })
  }

  // G-05: GET daily without date (latest)
  {
    const { status, body } = await apiGet<DailyReportData>(`${args.apiUrl}/api/daily`)
    const ok = status === 200 && body.success === true
    verboseLog(args, `  G-05 GET /api/daily (no date): status=${status}, date=${body.data?.date}`)
    results.push({
      stage: "G-05 Daily latest",
      status: ok ? "PASS" : "FAIL",
      details: ok ? `returns latest (date=${body.data?.date})` : `unexpected response (status=${status})`,
      duration: Date.now() - start,
    })
  }

  // G-06: GET weekly without week (latest)
  {
    const { status, body } = await apiGet<WeeklyReportData>(`${args.apiUrl}/api/weekly`)
    const ok = status === 200 && body.success === true
    verboseLog(args, `  G-06 GET /api/weekly (no week): status=${status}, week=${body.data?.weekNumber}`)
    results.push({
      stage: "G-06 Weekly latest",
      status: ok ? "PASS" : "FAIL",
      details: ok ? `returns latest (week=${body.data?.weekNumber})` : `unexpected response (status=${status})`,
      duration: Date.now() - start,
    })
  }

  return results
}

// ── Cross-Pipeline Integrity Tests (F-01~07) ───────────────

async function testCrossPipelineIntegrity(args: CliArgs): Promise<StageResult[]> {
  const start = Date.now()
  divider("TEST: Cross-pipeline integrity (F-01~07)")
  const results: StageResult[] = []

  // F-01: No orphaned DigestTopics
  {
    const allTopics = await prisma.digestTopic.findMany({ select: { dailyId: true } })
    const dailyIds = new Set((await prisma.dailyOverview.findMany({ select: { id: true } })).map((d) => d.id))
    const orphans = allTopics.filter((t) => !dailyIds.has(t.dailyId))
    const ok = orphans.length === 0
    verboseLog(args, `  F-01 DigestTopic orphans: ${orphans.length} (total ${allTopics.length})`)
    results.push({
      stage: "F-01 DigestTopic FK",
      status: ok ? "PASS" : "FAIL",
      details: ok ? "no orphans" : `${orphans.length} orphaned DigestTopics`,
      duration: Date.now() - start,
    })
  }

  // F-03: No orphaned WeeklyPicks
  {
    const allPicks = await prisma.weeklyPick.findMany({ select: { weeklyId: true } })
    const weeklyIds = new Set((await prisma.weeklyReport.findMany({ select: { id: true } })).map((w) => w.id))
    const orphans = allPicks.filter((p) => !weeklyIds.has(p.weeklyId))
    const ok = orphans.length === 0
    verboseLog(args, `  F-03 WeeklyPick orphans: ${orphans.length} (total ${allPicks.length})`)
    results.push({
      stage: "F-03 WeeklyPick FK",
      status: ok ? "PASS" : "FAIL",
      details: ok ? "no orphans" : `${orphans.length} orphaned WeeklyPicks`,
      duration: Date.now() - start,
    })
  }

  // F-04: topicCount accuracy (all reports)
  {
    const overviews = await prisma.dailyOverview.findMany({
      include: { topics: true },
    })
    let mismatchCount = 0
    for (const ov of overviews) {
      if (ov.topicCount !== ov.topics.length) {
        mismatchCount++
        verboseLog(args, `  F-04 ${ov.date}: stored=${ov.topicCount}, actual=${ov.topics.length}`)
      }
    }
    const ok = mismatchCount === 0
    results.push({
      stage: "F-04 topicCount accuracy",
      status: ok ? "PASS" : "FAIL",
      details: ok ? `all ${overviews.length} overviews correct` : `${mismatchCount}/${overviews.length} mismatches`,
      duration: Date.now() - start,
    })
  }

  // F-05: Weekly pick items come from daily topic items
  {
    const weeklyReports = await prisma.weeklyReport.findMany({
      include: { picks: true },
    })
    if (weeklyReports.length === 0) {
      results.push({ stage: "F-05 Weekly item source", status: "SKIP", details: "no weekly reports", duration: 0 })
    } else {
      const dailyOverviews = await prisma.dailyOverview.findMany({
        include: { topics: true },
        orderBy: { date: "desc" },
      })
      // Collect all topic itemIds from daily reports
      const dailyTopicItemIds = new Set<string>()
      for (const daily of dailyOverviews) {
        for (const topic of daily.topics) {
          for (const id of topic.itemIds) dailyTopicItemIds.add(id)
        }
      }

      let notFromDaily = 0
      let totalPicks = 0
      for (const report of weeklyReports) {
        for (const pick of report.picks) {
          totalPicks++
          if (!dailyTopicItemIds.has(pick.itemId)) {
            notFromDaily++
          }
        }
      }
      const ok = notFromDaily === 0
      verboseLog(args, `  F-05 weekly picks from daily topics: ${totalPicks - notFromDaily}/${totalPicks}`)
      results.push({
        stage: "F-05 Weekly item source",
        status: ok ? "PASS" : "FAIL",
        details: ok ? "all weekly pick items from daily topics" : `${notFromDaily}/${totalPicks} not from daily topics`,
        duration: Date.now() - start,
      })
    }
  }

  // F-06: Referenced items have non-null core fields
  {
    const allTopics = await prisma.digestTopic.findMany()
    const itemIds = new Set<string>()
    for (const t of allTopics) for (const id of t.itemIds) itemIds.add(id)

    if (itemIds.size === 0) {
      results.push({ stage: "F-06 Item fields", status: "SKIP", details: "no referenced items", duration: 0 })
    } else {
      const items = await prisma.item.findMany({
        where: { id: { in: Array.from(itemIds) } },
        select: { id: true, title: true, url: true, sourceId: true },
      })
      let invalidCount = 0
      for (const item of items) {
        if (!item.title || !item.url || !item.sourceId) invalidCount++
      }
      const ok = invalidCount === 0
      verboseLog(args, `  F-06 item field completeness: ${items.length - invalidCount}/${items.length} valid`)
      results.push({
        stage: "F-06 Item fields",
        status: ok ? "PASS" : "FAIL",
        details: ok ? "all items have required fields" : `${invalidCount} items missing fields`,
        duration: Date.now() - start,
      })
    }
  }

  // F-07: Referenced tweets have valid fields
  {
    const allTopics = await prisma.digestTopic.findMany()
    const tweetIds = new Set<string>()
    for (const t of allTopics) for (const id of t.tweetIds) tweetIds.add(id)

    if (tweetIds.size === 0) {
      results.push({ stage: "F-07 Tweet fields", status: "SKIP", details: "no referenced tweets", duration: 0 })
    } else {
      const tweets = await prisma.tweet.findMany({
        where: { id: { in: Array.from(tweetIds) } },
        select: { id: true, text: true, authorHandle: true, url: true },
      })
      let invalidCount = 0
      for (const tweet of tweets) {
        if (!tweet.text || !tweet.authorHandle || !tweet.url) invalidCount++
      }
      const ok = invalidCount === 0
      verboseLog(args, `  F-07 tweet field completeness: ${tweets.length - invalidCount}/${tweets.length} valid`)
      results.push({
        stage: "F-07 Tweet fields",
        status: ok ? "PASS" : "FAIL",
        details: ok ? "all tweets have required fields" : `${invalidCount} tweets missing fields`,
        duration: Date.now() - start,
      })
    }
  }

  return results
}

// ── Stage 9: Summary Table ────────────────────────────────

function printSummary(results: StageResult[]): void {
  divider("STAGE 9: Summary")

  console.log(`  ${"Stage".padEnd(24)} | ${"Status".padEnd(6)} | Details`)
  console.log(`  ${"-".repeat(24)} | ${"-".repeat(6)} | ${"-".repeat(50)}`)

  for (const r of results) {
    const icon = r.status === "PASS" ? "PASS" : r.status === "SKIP" ? "SKIP" : "FAIL"
    console.log(`  ${r.stage.padEnd(24)} | ${icon.padEnd(6)} | ${truncate(r.details, 50)}`)
  }

  const passed = results.filter((r) => r.status === "PASS").length
  const failed = results.filter((r) => r.status === "FAIL").length
  const skipped = results.filter((r) => r.status === "SKIP").length
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0)

  console.log(`\n  Total: ${results.length} | PASS: ${passed} | FAIL: ${failed} | SKIP: ${skipped}`)
  console.log(`  Total duration: ${(totalDuration / 1000).toFixed(1)}s`)
  console.log(`  Result: ${failed > 0 ? "FAIL (exit 1)" : "ALL PASS/SKIP (exit 0)"}\n`)
}

function writeJsonOutput(args: CliArgs, results: StageResult[]): void {
  if (!args.jsonOutput) return

  const mode = args.configOnly ? "config-only"
    : args.collectionOnly ? "collection-only"
    : args.dailyOnly ? "daily-only"
    : args.weeklyOnly ? "weekly-only"
    : "full"

  const output: JsonOutput = {
    runId: new Date().toISOString(),
    mode,
    config: {
      apiUrl: args.apiUrl,
      skipCollection: args.skipCollection,
      cleanup: args.cleanup,
      timeout: args.timeout,
      dailyPacks: args.dailyPacks,
      maxItems: args.maxItems,
      minScore: args.minScore,
      pickCount: args.pickCount,
    },
    results: results.map((r) => ({
      id: r.stage,
      stage: r.stage,
      status: r.status,
      duration: r.duration,
      details: r.details,
    })),
    summary: {
      total: results.length,
      passed: results.filter((r) => r.status === "PASS").length,
      failed: results.filter((r) => r.status === "FAIL").length,
      skipped: results.filter((r) => r.status === "SKIP").length,
      duration: results.reduce((sum, r) => sum + r.duration, 0),
    },
  }

  writeFileSync(args.jsonOutput, JSON.stringify(output, null, 2))
  console.log(`\n  JSON output written to ${args.jsonOutput}`)
}

// ── Main ──────────────────────────────────────────────────

async function main() {
  const args = parseArgs()

  console.log("\n" + "#".repeat(60))
  console.log("  Reports Pipeline End-to-End Verification")
  console.log(`  Started: ${new Date().toISOString()}`)
  console.log("#".repeat(60))

  const results: StageResult[] = []

  try {
    // Stage 0: Pre-checks
    const stage0 = await runStage0(args)
    results.push(stage0)
    if (stage0.status === "FAIL") {
      printSummary(results)
      writeJsonOutput(args, results)
      process.exit(1)
    }

    // Stage 1: Config
    const stage1 = await runStage1(args)
    results.push(stage1)

    // Extended config validation tests (B-04~08)
    if (args.configOnly || args.verbose) {
      const configTests = await testConfigValidation(args)
      results.push(...configTests)
    }

    // If --config-only, exit after Stage 1
    if (args.configOnly) {
      printSummary(results)
      writeJsonOutput(args, results)
      process.exit(0)
    }

    // Stage 2: Data inventory
    const stage2 = await runStage2(args)
    results.push(stage2)

    // Stage 3: Cleanup (if requested)
    if (args.cleanup) {
      const stage3 = await runStage3()
      results.push(stage3)
    }

    // Stage 4: Collection (unless skipped)
    if (!args.skipCollection && !args.weeklyOnly) {
      const stage4 = await runStage4(args)
      results.push(stage4)
    } else if (args.skipCollection) {
      const itemCount = await prisma.item.count()
      if (itemCount === 0) {
        console.warn("\n  [WARN] --skip-collection set but no items in DB. Daily report may fail.")
        results.push({ stage: "Collection", status: "SKIP", details: "skipped, no items in DB", duration: 0 })
      } else {
        console.log(`\n  [SKIP] Collection skipped (--skip-collection), ${itemCount} items in DB`)
        results.push({ stage: "Collection", status: "SKIP", details: `skipped, ${itemCount} items in DB`, duration: 0 })
      }
    }

    // If --collection-only, exit after collection
    if (args.collectionOnly) {
      printSummary(results)
      writeJsonOutput(args, results)
      process.exit(0)
    }

    // Stage 5+6: Daily report (unless weekly-only)
    if (!args.weeklyOnly) {
      const stage5 = await runStage5(args)
      results.push(stage5)

      if (stage5.status === "PASS") {
        const stage6 = await runStage6(args)
        results.push(stage6)
      } else if (stage5.status === "FAIL") {
        results.push({ stage: "Daily verify", status: "SKIP", details: "skipped (daily report failed)", duration: 0 })
      }
    }

    // Stage 7+8: Weekly report (unless daily-only)
    if (!args.dailyOnly) {
      const stage7 = await runStage7(args)
      results.push(stage7)

      if (stage7.status === "PASS") {
        const stage8 = await runStage8(args)
        results.push(stage8)
      } else if (stage7.status === "FAIL") {
        results.push({ stage: "Weekly verify", status: "SKIP", details: "skipped (weekly report failed)", duration: 0 })
      }
    }

    // Extended validation tests
    const emptyDataTests = await testEmptyDataApi(args)
    results.push(...emptyDataTests)

    const integrityTests = await testCrossPipelineIntegrity(args)
    results.push(...integrityTests)

    // Stage 9: Summary
    printSummary(results)
    writeJsonOutput(args, results)

    const hasFail = results.some((r) => r.status === "FAIL")
    if (hasFail) {
      process.exit(1)
    }
  } catch (err) {
    console.error(`\n[FATAL] ${err instanceof Error ? err.message : String(err)}`)
    if (err instanceof Error && err.stack) {
      console.error(`\n${err.stack}`)
    }
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
