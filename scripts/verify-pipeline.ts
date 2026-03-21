/**
 * Pipeline 端到端验证脚本
 *
 * 用法: LOG_LEVEL=DEBUG npx tsx scripts/verify-pipeline.ts
 *
 * 仅测试 2 个 source: infoq RSS + x bookmarks
 * 自动清理数据（保留配置表），验证收集→归一化→去重→落库→增强全流程
 */

import { prisma } from "../lib/prisma";
import { loadAllPacksFromDb } from "../src/config/load-pack-prisma";
import { generateSourceId } from "../src/config/source-id";
import { buildAdapters } from "../src/adapters/build-adapters";
import { collectSources, type CollectSourceEvent } from "../src/pipeline/collect";
import { normalizeItems } from "../src/pipeline/normalize";
import { dedupeExact } from "../src/pipeline/dedupe-exact";
import { dedupeNear } from "../src/pipeline/dedupe-near";
import { archiveRawItems } from "../src/archive/upsert-prisma";
import { getItemsToEnrich, enrichItems } from "../src/archive/enrich-prisma";
import { createAiClient, loadSettings } from "../src/ai/providers";
import { createLogger } from "../src/utils/logger";
import type { RawItem, NormalizedItem, SourceType } from "../src/types/index";

const log = createLogger("verify-pipeline");

// ── 目标 Source ──────────────────────────────────────────
const TARGET_URLS = [
  "https://www.infoq.cn/feed",
  "https://x.com/i/bookmarks",
];

// ── 工具函数 ─────────────────────────────────────────────

function divider(title: string) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"═".repeat(60)}\n`);
}

function elapsed(start: number): string {
  return `${((Date.now() - start) / 1000).toFixed(1)}s`;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function printItemTable(items: Array<{ title: string; url: string; sourceId?: string }>) {
  if (items.length === 0) {
    console.log("  (空)");
    return;
  }
  console.log(`  #  | ${"source".padEnd(22)} | title`);
  console.log(`  -- | ${"-".repeat(22)} | ${"-".repeat(50)}`);
  items.forEach((item, i) => {
    const src = truncate(item.sourceId ?? "???", 22).padEnd(22);
    const title = truncate(item.title, 60);
    console.log(`  ${String(i + 1).padStart(2)} | ${src} | ${title}`);
    console.log(`      ${"".padEnd(22)}   ${truncate(item.url, 90)}`);
  });
}

// ── Stage 0: 清理数据 ───────────────────────────────────

async function cleanData() {
  const start = Date.now();
  divider("STAGE 0: 清理数据");

  // 按外键依赖顺序删除
  const tables = [
    { name: "TimelineEvent", count: await prisma.timelineEvent.count() },
    { name: "WeeklyReport", count: await prisma.weeklyReport.count() },
    { name: "Bookmark", count: await prisma.bookmark.count() },
    { name: "NewsFlash", count: await prisma.newsFlash.count() },
    { name: "DailyOverview", count: await prisma.dailyOverview.count() },
    { name: "Item", count: await prisma.item.count() },
    { name: "SourceHealth", count: await prisma.sourceHealth.count() },
  ];

  for (const t of tables) {
    if (t.count > 0) {
      const sql = `DELETE FROM "${t.name}"`;
      await prisma.$executeRawUnsafe(sql);
      console.log(`  ✓ 删除 ${t.name}: ${t.count} 条`);
    } else {
      console.log(`  - ${t.name}: 0 条 (跳过)`);
    }
  }

  console.log(`\n  清理完成，耗时 ${elapsed(start)}`);
}

// ── Stage 1: 加载并筛选 Source ──────────────────────────

interface ResolvedSource {
  id: string;
  type: SourceType;
  url: string;
  description?: string;
  packId: string;
  configJson?: string;
}

function resolveSourcesForCollection(packs: Awaited<ReturnType<typeof loadAllPacksFromDb>>): ResolvedSource[] {
  const seen = new Set<string>();
  const sources: ResolvedSource[] = [];
  for (const pack of packs) {
    for (const source of pack.sources) {
      if (!source.enabled && source.enabled !== undefined) continue;
      if (seen.has(source.url)) continue;
      seen.add(source.url);
      sources.push({
        ...source,
        id: generateSourceId(source.url),
        packId: pack.id,
      });
    }
  }
  return sources;
}

async function loadTargetSources(): Promise<ResolvedSource[]> {
  const start = Date.now();
  divider("STAGE 1: 加载 Source");

  const packs = await loadAllPacksFromDb();
  console.log(`  加载 ${packs.length} 个 pack`);

  const allSources = resolveSourcesForCollection(packs);
  console.log(`  共 ${allSources.length} 个已启用 source`);

  // 筛选目标 source
  const targetUrlSet = new Set(TARGET_URLS);
  const targets = allSources.filter((s) => targetUrlSet.has(s.url));

  if (targets.length === 0) {
    console.error("\n  ✗ 未找到目标 source！");
    console.error("  期望的 URL:");
    for (const url of TARGET_URLS) {
      console.error(`    - ${url}`);
    }
    console.error("\n  请在 Settings 页面确认以下 source 已配置:");
    for (const url of TARGET_URLS) {
      const exists = allSources.some((s) => s.url === url);
      console.error(`    ${exists ? "✓" : "✗"} ${url}`);
    }
    process.exit(1);
  }

  for (const s of targets) {
    console.log(`  ✓ ${s.type.padEnd(16)} ${s.url}`);
  }

  console.log(`\n  筛选完成，耗时 ${elapsed(start)}`);
  return targets;
}

// ── Stage 2: Collect ────────────────────────────────────

async function runCollect(sources: ResolvedSource[]) {
  const start = Date.now();
  divider("STAGE 2: COLLECT");

  const events: CollectSourceEvent[] = [];

  const adapters = await buildAdapters();
  console.log(`  可用 adapter: ${Object.keys(adapters).join(", ")}`);

  const missing = sources.filter((s) => !adapters[s.type]);
  if (missing.length > 0) {
    console.error(`  ✗ 缺少 adapter: ${missing.map((s) => `${s.type} (${s.url})`).join(", ")}`);
    process.exit(1);
  }

  const items = await collectSources(sources, {
    adapters,
    concurrency: 2,
    onSourceEvent: (event) => events.push(event),
  });

  console.log(`\n  Source 事件:`);
  for (const e of events) {
    const icon = e.status === "success" ? "✓" : e.status === "zero-items" ? "○" : "✗";
    const detail = e.error ? ` (${truncate(e.error, 60)})` : "";
    console.log(`    ${icon} ${e.sourceId.padEnd(30)} ${String(e.itemCount).padStart(4)} 条  ${e.latencyMs ?? 0}ms${detail}`);
  }

  console.log(`\n  共收集 ${items.length} 条，耗时 ${elapsed(start)}`);

  // 打印前 10 条
  if (items.length > 0) {
    console.log("\n  收集结果（前 10 条）:");
    printItemTable(items.slice(0, 10));
  }

  return items;
}

// ── Stage 3: Normalize ──────────────────────────────────

function runNormalize(items: RawItem[]) {
  const start = Date.now();
  divider("STAGE 3: NORMALIZE");

  const normalized = normalizeItems(items);
  console.log(`  输入 ${items.length} 条 → 输出 ${normalized.length} 条`);
  console.log(`  耗时 ${elapsed(start)}`);

  if (normalized.length > 0) {
    console.log("\n  归一化结果（前 5 条）:");
    const sample = normalized.slice(0, 5);
    console.log(`  #  | ${"canonicalUrl".padEnd(50)} | title`);
    console.log(`  -- | ${"-".repeat(50)} | ${"-".repeat(40)}`);
    sample.forEach((item, i) => {
      const url = truncate(item.canonicalUrl ?? item.url ?? "", 50).padEnd(50);
      const title = truncate(item.normalizedTitle ?? item.title ?? "", 40);
      console.log(`  ${String(i + 1).padStart(2)} | ${url} | ${title}`);
    });
  }

  return normalized;
}

// ── Stage 4: Dedupe ─────────────────────────────────────

function runDedupe(normalized: NormalizedItem[]) {
  const start = Date.now();
  divider("STAGE 4: DEDUPE");

  const withKey = normalized.filter(
    (i): i is NormalizedItem & { exactDedupKey: string } => !!i.exactDedupKey,
  );
  console.log(`  有 exactDedupKey: ${withKey.length} / ${normalized.length}`);

  const afterExact = dedupeExact(withKey);
  console.log(`  Exact dedupe: ${withKey.length} → ${afterExact.length} (去除 ${withKey.length - afterExact.length})`);

  const withProcessed = afterExact.filter(
    (i): i is NormalizedItem & { exactDedupKey: string; processedAt: string } => !!i.processedAt,
  );
  const afterNear = dedupeNear(withProcessed);
  console.log(`  Near dedupe:  ${withProcessed.length} → ${afterNear.length} (去除 ${withProcessed.length - afterNear.length})`);

  console.log(`  总计: ${normalized.length} → ${afterNear.length}，耗时 ${elapsed(start)}`);
  return afterNear;
}

// ── Stage 5: Archive ────────────────────────────────────

async function runArchive(normalized: NormalizedItem[], sources: ResolvedSource[]) {
  const start = Date.now();
  divider("STAGE 5: ARCHIVE (落库)");

  const dedupedRawItems: RawItem[] = normalized.map((item) => ({
    id: item.id,
    sourceId: item.sourceId ?? "",
    title: item.title ?? "",
    url: item.canonicalUrl ?? item.url ?? "",
    fetchedAt: item.processedAt ?? new Date().toISOString(),
    metadataJson: item.metadataJson ?? "{}",
    publishedAt: item.processedAt,
    author: undefined,
    content: item.content,
  }));

  const now = new Date().toISOString();
  const sourceNameMap = Object.fromEntries(sources.map((s) => [s.id, s.description ?? s.id]));
  const result = await archiveRawItems(dedupedRawItems, now, sourceNameMap);

  console.log(`  总条目: ${result.totalCount}`);
  console.log(`  新增:    ${result.newCount}`);
  console.log(`  更新:    ${result.updateCount}`);
  console.log(`  新增 ID: ${result.newItemIds.length > 0 ? result.newItemIds.join(", ") : "(无)"}`);
  console.log(`  耗时 ${elapsed(start)}`);

  return result;
}

// ── Stage 6: Enrich ─────────────────────────────────────

async function runEnrich(newItemIds: string[]) {
  const start = Date.now();
  divider("STAGE 6: ENRICH (AI 增强)");

  if (newItemIds.length === 0) {
    console.log("  无新条目，跳过 enrichment");
    return;
  }

  const settings = await loadSettings();
  if (!settings) {
    console.warn("  ⚠ 无法加载 AI settings，跳过 enrichment");
    return;
  }

  const aiClient = await createAiClient();
  if (!aiClient) {
    console.warn("  ⚠ 无法创建 AI client，跳过 enrichment");
    return;
  }

  const enrichItemIds = await getItemsToEnrich("new", newItemIds);
  console.log(`  待增强条目: ${enrichItemIds.length}`);

  if (enrichItemIds.length === 0) {
    console.log("  无需增强，跳过");
    return;
  }

  const result = await enrichItems(enrichItemIds, aiClient);

  console.log(`  成功: ${result.successCount}`);
  console.log(`  失败: ${result.failCount}`);
  console.log(`  总计: ${result.totalCount}`);
  console.log(`  耗时 ${elapsed(start)}`);
}

// ── Stage 7: 验证 DB 状态 ──────────────────────────────

async function verifyDb() {
  const start = Date.now();
  divider("STAGE 7: 验证 DB 最终状态");

  const totalItems = await prisma.item.count();
  console.log(`  Item 总数: ${totalItems}`);

  if (totalItems > 0) {
    const bySource = await prisma.item.groupBy({
      by: ["sourceId"],
      _count: { id: true },
    });
    console.log("\n  按 source 分布:");
    for (const row of bySource) {
      console.log(`    ${row.sourceId.padEnd(30)} ${String(row._count.id).padStart(4)} 条`);
    }

    // 抽样检查
    const sample = await prisma.item.findMany({
      take: 5,
      orderBy: { fetchedAt: "desc" },
      select: {
        id: true,
        title: true,
        url: true,
        sourceId: true,
        score: true,
        summary: true,
        bullets: true,
        categories: true,
        content: true,
      },
    });

    console.log("\n  最新 5 条 Item:");
    for (const item of sample) {
      console.log(`\n  ── ${truncate(item.title, 60)}`);
      console.log(`     URL:     ${truncate(item.url, 80)}`);
      console.log(`     Source:  ${item.sourceId}`);
      console.log(`     Score:   ${item.score}`);
      console.log(`     Summary: ${item.summary ? truncate(item.summary, 50) : "(空)"}`);
      console.log(`     Bullets: ${item.bullets.length > 0 ? item.bullets.length + " 条" : "(空)"}`);
      console.log(`     Tags:    ${item.categories.length > 0 ? item.categories.join(", ") : "(空)"}`);
      console.log(`     Content: ${item.content ? item.content.length + " 字符" : "(空)"}`);
    }
  }

  // Source health 检查
  const healthRecords = await prisma.sourceHealth.findMany();
  console.log(`\n  SourceHealth 记录: ${healthRecords.length}`);
  for (const h of healthRecords) {
    console.log(`    ${h.sourceId.padEnd(30)} lastSuccess=${h.lastSuccessAt?.toISOString() ?? "无"}  failures=${h.consecutiveFailures}`);
  }

  console.log(`\n  验证完成，耗时 ${elapsed(start)}`);
}

// ── Main ────────────────────────────────────────────────

async function main() {
  const totalStart = Date.now();
  console.log("\n" + "█".repeat(60));
  console.log("  Pipeline 端到端验证");
  console.log(`  目标: ${TARGET_URLS.join(", ")}`);
  console.log(`  开始: ${new Date().toISOString()}`);
  console.log("█".repeat(60));

  try {
    // Stage 0: 清理
    await cleanData();

    // Stage 1: 加载 source
    const sources = await loadTargetSources();

    // Stage 2: Collect
    const items = await runCollect(sources);

    if (items.length === 0) {
      console.error("\n  ✗ 收集结果为空，无法继续");
      process.exit(1);
    }

    // Stage 3: Normalize
    const normalized = runNormalize(items);

    // Stage 4: Dedupe
    const deduped = runDedupe(normalized);

    if (deduped.length === 0) {
      console.warn("\n  ⚠ 去重后无条目，跳过归档");
    } else {
      // Stage 5: Archive
      const archiveResult = await runArchive(deduped, sources);

      // Stage 6: Enrich
      await runEnrich(archiveResult.newItemIds);
    }

    // Stage 7: 验证
    await verifyDb();

    console.log(`\n${"█".repeat(60)}`);
    console.log(`  全部完成！总耗时 ${elapsed(totalStart)}`);
    console.log("█".repeat(60) + "\n");
  } catch (error) {
    console.error(`\n✗ 脚本失败: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      console.error(`\n${error.stack}`);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
