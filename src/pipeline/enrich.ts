/**
 * Enrich Pipeline
 * 对候选项进行深度 enrichment，包括正文提取和 AI 增强
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
 * 对候选项进行深度 enrichment
 * @param candidates 候选项列表
 * @param dependencies 依赖项
 * @returns enrichment 后的候选项列表
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

  const enriched = [...candidates];

  // ========== 第一阶段：传统 AI 评分（向后兼容） ==========
  if (scoreCandidate && limit > 0) {
    for (const candidate of enriched.slice(0, limit)) {
      try {
        candidate.contentQualityAi = await scoreCandidate(candidate);
      } catch (error) {
        logger.error("AI scoring failed", { candidateId: candidate.id, error: error instanceof Error ? error.message : String(error) });
        candidate.contentQualityAi = 0;
      }
    }
  }

  // 如果未启用深度 enrichment，直接返回
  if (!enableContentExtraction) {
    return enriched;
  }

  // ========== 第二阶段：正文提取 ==========
  const toExtract = enriched.slice(0, contentExtractionLimit);
  const extractionPromises = toExtract.map(async (candidate) => {
    const url = candidate.url ?? candidate.canonicalUrl;

    // 社交帖子：内容已在 normalizedText 中，跳过 URL 提取
    if (isSocialPost(candidate)) {
      logger.debug("Social post detected, using existing content", {
        candidateId: candidate.id,
        contentType: candidate.contentType,
        sourceType: candidate.sourceType,
        contentLength: candidate.normalizedText?.length ?? 0,
      });
      return { candidate, result: createSocialPostContent(candidate) };
    }

    if (!url) {
      return { candidate, result: null };
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

      return { candidate, result: extractedContent };
    } catch (error) {
      logger.error("Content extraction failed", { url, candidateId: candidate.id, error: error instanceof Error ? error.message : String(error) });
      return {
        candidate,
        result: {
          url,
          extractedAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  const extractionResults = await Promise.all(extractionPromises);

  // 将提取结果附加到候选项
  for (const { candidate, result } of extractionResults) {
    if (result) {
      candidate.extractedContent = result;
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
      async ({ candidate, result }) => {
        if (!result || !isExtractionSuccess(result)) {
          return { candidate, aiResult: null };
        }

        const title = candidate.title ?? candidate.normalizedTitle ?? "";
        const content = result.textContent ?? result.content ?? "";

        if (!content) {
          return { candidate, aiResult: null };
        }

        try {
          const aiEnrichment: AiEnrichmentResult = {};

          // 基于完整内容的质量评分
          try {
            const score = await aiClient.scoreWithContent(title, content, candidate.url);
            aiEnrichment.score = score;
            // 更新 contentQualityAi（覆盖之前的评分）
            candidate.contentQualityAi = score;
          } catch (error) {
            logger.debug("AI scoring failed, keeping original score", {
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

          return { candidate, aiResult: aiEnrichment };
        } catch (error) {
          logger.error("AI enrichment failed", { candidateId: candidate.id, error: error instanceof Error ? error.message : String(error) });
          return { candidate, aiResult: null };
        }
      }
    );

    // 将 AI 增强结果附加到候选项
    for (const { candidate, aiResult } of aiResults) {
      if (aiResult) {
        candidate.aiEnrichment = aiResult;
      }
    }
  }

  // ========== 第四阶段：持久化到数据库 ==========
  if (db) {
    const { upsertEnrichmentResult } = await import("../db/client");
    for (const candidate of enriched) {
      if (candidate.extractedContent || candidate.aiEnrichment) {
        try {
          upsertEnrichmentResult(
            db,
            candidate.id,
            candidate.extractedContent,
            candidate.aiEnrichment,
          );
        } catch (error) {
          logger.error("Failed to persist enrichment", { candidateId: candidate.id, error: error instanceof Error ? error.message : String(error) });
        }
      }
    }
  }

  return enriched;
}
