/**
 * Policy Filter 阶段
 * 根据 Pack/Source 的策略过滤候选条目
 */

import type { Database } from "bun:sqlite";
import type { RankedCandidate, SourcePack } from "../types/index";
import type { SourcePolicy } from "../types/policy";
import type { AiClient } from "../ai/types";
import type { FilterJudgment } from "../types/ai-response";
import { createLogger } from "../utils/logger";
import { generateFingerprint, getCachedJudgment, saveJudgment, batchGetCachedJudgments, batchSaveJudgments } from "../policy/filter-cache";

const logger = createLogger("pipeline:policy-filter");

/**
 * Policy Filter 配置
 */
export interface PolicyFilterConfig {
  /** AI 客户端（可选，用于 filter_then_assist 模式） */
  aiClient?: AiClient;
  /** 数据库实例（可选，用于缓存） */
  db?: Database;
  /** 批处理大小（默认 10） */
  batchSize?: number;
  /** 并发数（默认 3，由 AI client 内部处理） */
  concurrency?: number;
}

/**
 * Policy Filter 统计信息
 */
export interface PolicyFilterStats {
  /** 总输入条目数 */
  totalInput: number;
  /** assist_only 模式保留数 */
  assistOnlyKept: number;
  /** filter_then_assist 模式处理数 */
  filterThenAssistProcessed: number;
  /** filter_then_assist 模式过滤掉数 */
  filterThenAssistFiltered: number;
  /** 无策略条目数 */
  noPolicyCount: number;
  /** AI 调用次数 */
  aiCallCount: number;
  /** 处理耗时（毫秒） */
  elapsedMs: number;
}

/**
 * Policy Filter 结果
 */
export interface PolicyFilterResult {
  /** 保留的候选条目 */
  kept: RankedCandidate[];
  /** 过滤掉的候选条目 */
  filtered: RankedCandidate[];
  /** 统计信息 */
  stats: PolicyFilterStats;
}

/**
 * 带判断结果的候选条目
 */
interface CandidateWithJudgment {
  candidate: RankedCandidate;
  judgment?: FilterJudgment;
}

/**
 * 按策略过滤候选条目
 *
 * @param candidates - 候选条目列表
 * @param pack - 当前 Pack 信息
 * @param sourcePolicyMap - Source ID 到策略的映射
 * @param config - 过滤配置
 * @returns 过滤结果
 */
export async function policyFilterCandidates(
  candidates: RankedCandidate[],
  pack: SourcePack,
  sourcePolicyMap: Map<string, SourcePolicy>,
  config: PolicyFilterConfig = {}
): Promise<PolicyFilterResult> {
  const startTime = Date.now();
  const { aiClient, batchSize = 10 } = config;

  // 初始化统计
  const stats: PolicyFilterStats = {
    totalInput: candidates.length,
    assistOnlyKept: 0,
    filterThenAssistProcessed: 0,
    filterThenAssistFiltered: 0,
    noPolicyCount: 0,
    aiCallCount: 0,
    elapsedMs: 0,
  };

  // 空输入快速返回
  if (candidates.length === 0) {
    stats.elapsedMs = Date.now() - startTime;
    return { kept: [], filtered: [], stats };
  }

  // 按 sourceId 分组
  const bySource = groupBySource(candidates);

  // 处理结果
  const kept: RankedCandidate[] = [];
  const filtered: RankedCandidate[] = [];

  // 处理每个 source 组
  for (const [sourceId, groupCandidates] of bySource) {
    const policy = sourcePolicyMap.get(sourceId);

    if (!policy) {
      // 无策略：保留所有条目
      stats.noPolicyCount += groupCandidates.length;
      kept.push(...groupCandidates);
      continue;
    }

    if (policy.mode === "assist_only") {
      // assist_only 模式：直接保留所有条目
      stats.assistOnlyKept += groupCandidates.length;
      kept.push(...groupCandidates);
    } else if (policy.mode === "filter_then_assist") {
      // filter_then_assist 模式：调用 AI 过滤
      stats.filterThenAssistProcessed += groupCandidates.length;

      if (!aiClient) {
        // 无 AI 客户端：保留所有条目（降级处理）
        logger.warn("filter_then_assist 模式无 AI 客户端，fallback 到 assist_only", {
          sourceId,
          count: groupCandidates.length,
        });
        kept.push(...groupCandidates);
        continue;
      }

      // 批量处理
      const batches = chunk(groupCandidates, batchSize);
      for (const batch of batches) {
        try {
          const result = await processFilterThenAssist(
            batch,
            pack,
            aiClient,
            config.db
          );
          stats.aiCallCount++;

          for (const item of result) {
            if (item.judgment?.keepDecision) {
              kept.push(item.candidate);
            } else {
              filtered.push(item.candidate);
              stats.filterThenAssistFiltered++;
            }
          }
        } catch (error) {
          // AI 调用失败：fallback 到 assist_only
          logger.error("AI 过滤调用失败，fallback 到 assist_only", {
            sourceId,
            batchSize: batch.length,
            error: error instanceof Error ? error.message : String(error),
          });
          // 保留所有条目作为降级处理
          kept.push(...batch);
        }
      }
    }
  }

  stats.elapsedMs = Date.now() - startTime;

  return { kept, filtered, stats };
}

/**
 * 处理 filter_then_assist 模式的一批候选条目
 * 支持缓存查询和保存
 */
async function processFilterThenAssist(
  candidates: RankedCandidate[],
  pack: SourcePack,
  aiClient: AiClient,
  db?: Database
): Promise<CandidateWithJudgment[]> {
  // 构建缓存查询参数
  const cacheQueries = candidates.map((c) => ({
    itemId: c.id,
    fingerprint: generateFingerprint(c.url || c.canonicalUrl || "", c.processedAt || null),
  }));

  // 批量查询缓存
  const cachedJudgments = db
    ? await batchGetCachedJudgments(db, cacheQueries)
    : new Map<string, FilterJudgment>();

  // 分离需要 AI 判断的条目
  const needsAiJudgment: Array<{ candidate: RankedCandidate; index: number }> = [];
  const results: Array<{ candidate: RankedCandidate; judgment?: FilterJudgment }> = [];

  candidates.forEach((candidate, index) => {
    const cached = cachedJudgments.get(candidate.id);
    if (cached) {
      // 使用缓存结果
      results.push({ candidate, judgment: cached });
    } else {
      // 需要 AI 判断
      needsAiJudgment.push({ candidate, index });
      results.push({ candidate, judgment: undefined });
    }
  });

  // 如果有需要 AI 判断的条目，批量调用 AI
  if (needsAiJudgment.length > 0) {
    const filterItems = needsAiJudgment.map((item) => ({
      index: item.index,
      title: item.candidate.title || item.candidate.normalizedTitle || "",
      snippet: item.candidate.normalizedText || "",
      url: item.candidate.url || item.candidate.canonicalUrl || "",
    }));

    const packContext = {
      name: pack.name,
      keywords: pack.keywords || [],
      description: pack.description,
    };

    const aiJudgments = await aiClient.batchFilter(filterItems, packContext);

    // 将 AI 结果填充到结果数组，并准备保存缓存
    const judgmentsToSave = new Map<string, { judgment: FilterJudgment; fingerprint: string }>();

    needsAiJudgment.forEach((item, i) => {
      const judgment = aiJudgments[i];
      // 找到原始结果的位置并更新
      const originalIndex = candidates.indexOf(item.candidate);
      if (originalIndex >= 0 && results[originalIndex]) {
        results[originalIndex].judgment = judgment;
      }

      // 准备保存缓存
      if (db && judgment) {
        const fingerprint = cacheQueries[originalIndex]?.fingerprint || "";
        judgmentsToSave.set(item.candidate.id, { judgment, fingerprint });
      }
    });

    // 批量保存缓存
    if (db && judgmentsToSave.size > 0) {
      await batchSaveJudgments(db, judgmentsToSave);
    }
  }

  return results;
}

/**
 * 按 sourceId 分组
 */
function groupBySource(
  candidates: RankedCandidate[]
): Map<string, RankedCandidate[]> {
  const result = new Map<string, RankedCandidate[]>();

  for (const candidate of candidates) {
    const sourceId = candidate.sourceId || "unknown";
    if (!result.has(sourceId)) {
      result.set(sourceId, []);
    }
    result.get(sourceId)!.push(candidate);
  }

  return result;
}

/**
 * 数组分块
 */
function chunk<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}
