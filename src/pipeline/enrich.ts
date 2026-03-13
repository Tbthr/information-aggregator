/**
 * Enrich Pipeline
 * 对候选项进行深度 enrichment，包括正文提取和 AI 增强
 *
 * 设计原则：不修改输入的 candidates 数组及其元素，所有 enrichment 结果通过创建新对象返回
 */

import type { RankedCandidate, EnrichmentConfig, ExtractedContent, AiEnrichmentResult } from "../types/index";
import type { AiClient } from "../ai/client";
import type { Database } from "bun:sqlite";
import type { ContentCache } from "../cache/content-cache";

import { extractArticleContent, isExtractionSuccess } from "./extract-content";
import { processWithConcurrency } from "../ai/concurrency";
import type { EnrichmentResultDb, getEnrichmentResult, setExtractedContentCache, upsertEnrichmentResult } from "../db/client";
import { createLogger } from "../utils/logger";
import { isSocialPost, createSocialPostContent } from "../utils/social-post";

const logger = createLogger("pipeline:enrich");

/**
 * Enrich 依赖项
 */
export interface EnrichDependencies {
  // 现有字段（向后兼容）
  limit?: number;
  scoreCandidate?: (candidate: RankedCandidate) => Promise<number>;

  // 深度 enrichment 相关字段
  enrichmentConfig?: EnrichmentConfig;
  fetchImpl?: typeof fetch;
  aiClient?: AiClient | null;
  db?: Database | null;
  cache?: ContentCache<ExtractedContent> | null;
}

/**
 * 默认 enrichment 配置
 */
const DEFAULT_ENRICHMENT_CONFIG: Required<Omit<EnrichmentConfig, "enableContentExtraction" | "enableKeyPoints" | "enableTagging" | "cacheEnabled">> = {
  contentExtractionLimit: 5,
  contentExtractionTimeout: 15000,
  cacheTtl: 86400,
  maxContentLength: 10000,
};

/**
 * 内部 enrichment 结果存储（用于不可变性设计）
 */
interface EnrichmentState {
  extractedContent?: ExtractedContent;
  aiEnrichment?: AiEnrichmentResult;
  contentQualityAi?: number;
}

/**
 * 对候选项进行深度 enrichment
 * @param candidates 候选项列表（不会被修改）
 * @param dependencies 依赖项
 * @returns enrichment 后的候选项列表（新对象）
 */
export async function enrichCandidates<T extends RankedCandidate>(
  candidates: T[],
  dependencies: EnrichDependencies = {},
): Promise<T[]> {
  const {
    // 传统 AI 评分
    limit = 0,
    scoreCandidate,

    // 深度 enrichment
    enrichmentConfig = {},
    fetchImpl = fetch,
    aiClient,
    db,
    cache,
  } = dependencies;

  // 合并配置
  const config = { ...DEFAULT_ENRICHMENT_CONFIG, ...enrichmentConfig };
  const {
    enableContentExtraction = true,
    contentExtractionLimit = config.contentExtractionLimit,
    contentExtractionTimeout = config.contentExtractionTimeout,
    enableKeyPoints = true,
    enableTagging = true,
    cacheEnabled = true,
    cacheTtl = config.cacheTtl,
    maxContentLength = config.maxContentLength,
  } = config;

  // 使用 Map 存储 enrichment 结果，避免修改原始对象
  const enrichmentMap = new Map<string, EnrichmentState>();

  // ========== 第一阶段：传统 AI 评分（向后兼容） ==========
  if (scoreCandidate && limit > 0) {
    for (const candidate of candidates.slice(0, limit)) {
      try {
        const score = await scoreCandidate(candidate);
        enrichmentMap.set(candidate.id, { ...(enrichmentMap.get(candidate.id) ?? {}), contentQualityAi: score });
      } catch (error) {
        logger.warn("AI scoring failed, using fallback score 0", {
          candidateId: candidate.id,
          error: error instanceof Error ? error.message : String(error),
        });
        enrichmentMap.set(candidate.id, { ...(enrichmentMap.get(candidate.id) ?? {}), contentQualityAi: 0 });
      }
    }
  }

  // 如果未启用深度 enrichment，直接合并返回
  if (!enableContentExtraction) {
    return mergeEnrichmentResults(candidates, enrichmentMap);
  }

  // ========== 第二阶段：正文提取（带并发控制） ==========
  const toExtract = candidates.slice(0, contentExtractionLimit);
  const extractionConcurrency = config.extractionConcurrency ?? 3;
  const extractionBatchSize = config.extractionBatchSize ?? 5;

  const extractionResults = await processWithConcurrency(
    toExtract,
    { batchSize: extractionBatchSize, concurrency: extractionConcurrency },
    async (candidate) => {
      const url = candidate.url ?? candidate.canonicalUrl;

      // 社交帖子：内容已在 normalizedText 中，跳过 URL 提取
      if (isSocialPost(candidate)) {
        logger.debug("Social post detected, using existing content", {
          candidateId: candidate.id,
          contentType: candidate.contentType,
          sourceType: candidate.sourceType,
          contentLength: candidate.normalizedText?.length ?? 0,
        });
        return { candidateId: candidate.id, result: createSocialPostContent(candidate) };
      }

      if (!url) {
        return { candidateId: candidate.id, result: null };
      }

      try {
        // 检查内存缓存
        let extractedContent: ExtractedContent | null = null;
        if (cache && cacheEnabled) {
          extractedContent = cache.get(url);
        }

        // 检查数据库缓存
        if (!extractedContent && db && cacheEnabled) {
          const { getExtractedContentCache } = await import("../db/client");
          extractedContent = getExtractedContentCache(db, url);
        }

        // 执行提取
        if (!extractedContent) {
          extractedContent = await extractArticleContent(url, {
            timeout: contentExtractionTimeout,
            fetchImpl,
            maxLength: maxContentLength,
          });

          // 保存到缓存
          if (isExtractionSuccess(extractedContent)) {
            if (cache && cacheEnabled) {
              cache.set(url, extractedContent, cacheTtl);
            }
            if (db && cacheEnabled) {
              const { setExtractedContentCache } = await import("../db/client");
              setExtractedContentCache(db, url, extractedContent, cacheTtl);
            }
          }
        }

        return { candidateId: candidate.id, result: extractedContent };
      } catch (error) {
        logger.warn("Content extraction failed", {
          url,
          candidateId: candidate.id,
          error: error instanceof Error ? error.message : String(error),
        });
        return {
          candidateId: candidate.id,
          result: {
            url,
            extractedAt: new Date().toISOString(),
            error: error instanceof Error ? error.message : String(error),
          },
        };
      }
    },
  );

  // 将提取结果存储到 Map（不修改原始对象）
  for (const { candidateId, result } of extractionResults) {
    if (result) {
      const existing = enrichmentMap.get(candidateId) ?? {};
      enrichmentMap.set(candidateId, { ...existing, extractedContent: result });
    }
  }

  // ========== 第三阶段：AI 增强（基于完整正文） ==========
  if (aiClient) {
    // 过滤出有效的提取结果
    const validResults = extractionResults.filter(
      ({ result }) => result && isExtractionSuccess(result)
    );

    // 使用并发控制处理 AI 请求
    const aiBatchSize = config.aiBatchSize ?? 5;
    const aiConcurrency = config.aiConcurrency ?? 2;
    const aiResults = await processWithConcurrency(
      validResults,
      { batchSize: aiBatchSize, concurrency: aiConcurrency },
      async ({ candidateId, result }) => {
        // 从原始 candidates 中找到对应的 candidate
        const candidate = candidates.find(c => c.id === candidateId);
        if (!candidate || !result || !isExtractionSuccess(result)) {
          return { candidateId, aiResult: null };
        }

        const title = candidate.title ?? candidate.normalizedTitle ?? "";
        const content = result.textContent ?? result.content ?? "";

        if (!content) {
          return { candidateId, aiResult: null };
        }

        try {
          const aiEnrichment: AiEnrichmentResult = {};

          // 基于完整内容的质量评分
          try {
            const score = await aiClient.scoreWithContent(title, content, candidate.url);
            aiEnrichment.score = score;
          } catch (error) {
            logger.debug("AI scoring with content failed, keeping original score", {
              candidateId: candidate.id,
              error: error instanceof Error ? error.message : String(error),
            });
          }

          // 关键点提取
          if (enableKeyPoints) {
            try {
              const keyPoints = await aiClient.extractKeyPoints(title, content);
              if (keyPoints.length > 0) {
                aiEnrichment.keyPoints = keyPoints;
              }
            } catch (error) {
              logger.debug("Key points extraction failed", {
                candidateId: candidate.id,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }

          // 标签生成
          if (enableTagging) {
            try {
              const tags = await aiClient.generateTags(title, content);
              if (tags.length > 0) {
                aiEnrichment.tags = tags;
              }
            } catch (error) {
              logger.debug("Tag generation failed", {
                candidateId: candidate.id,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }

          return { candidateId, aiResult: aiEnrichment };
        } catch (error) {
          logger.warn("AI enrichment failed", {
            candidateId: candidate.id,
            error: error instanceof Error ? error.message : String(error),
          });
          return { candidateId, aiResult: null };
        }
      }
    );

    // 将 AI 增强结果存储到 Map（不修改原始对象）
    for (const { candidateId, aiResult } of aiResults) {
      if (aiResult) {
        const existing = enrichmentMap.get(candidateId) ?? {};
        // 如果 AI 评分成功，更新 contentQualityAi
        const update: EnrichmentState = { ...existing, aiEnrichment: aiResult };
        if (aiResult.score !== undefined) {
          update.contentQualityAi = aiResult.score;
        }
        enrichmentMap.set(candidateId, update);
      }
    }
  }

  // ========== 第四阶段：持久化到数据库 ==========
  if (db) {
    const { upsertEnrichmentResult } = await import("../db/client");
    for (const [candidateId, state] of enrichmentMap) {
      if (state.extractedContent || state.aiEnrichment) {
        try {
          upsertEnrichmentResult(
            db,
            candidateId,
            state.extractedContent,
            state.aiEnrichment,
          );
        } catch (error) {
          logger.warn("Failed to persist enrichment", {
            candidateId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  }

  // 合并结果，返回新数组
  return mergeEnrichmentResults(candidates, enrichmentMap);
}

/**
 * 合并 enrichment 结果到原始 candidates，创建新对象
 */
function mergeEnrichmentResults<T extends RankedCandidate>(
  candidates: T[],
  enrichmentMap: Map<string, EnrichmentState>,
): T[] {
  return candidates.map((candidate) => {
    const state = enrichmentMap.get(candidate.id);
    if (!state) {
      return candidate;
    }

    // 创建新对象，合并 enrichment 结果
    return {
      ...candidate,
      ...(state.contentQualityAi !== undefined && { contentQualityAi: state.contentQualityAi }),
      ...(state.extractedContent && { extractedContent: state.extractedContent }),
      ...(state.aiEnrichment && { aiEnrichment: state.aiEnrichment }),
    };
  });
}
