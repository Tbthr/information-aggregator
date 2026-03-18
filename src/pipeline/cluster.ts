import type { Cluster } from "../types/index";

/**
 * 分词并归一化
 * - 按空格分割
 * - 去掉常见后缀 (ed, es, s)
 */
function tokenize(text: string): Set<string> {
  const normalizeToken = (token: string): string => token.replace(/(?:ed|es|s)$/i, "");
  return new Set(text.split(/\s+/).filter(Boolean).map(normalizeToken));
}

/**
 * 计算两个 token 集合的 Jaccard 相似度
 */
function similarityWithTokens(left: Set<string>, right: Set<string>): number {
  let overlap = 0;
  for (const token of left) {
    if (right.has(token)) {
      overlap += 1;
    }
  }
  return overlap / Math.max(left.size, right.size, 1);
}

/**
 * 计算两个标题的相似度（便捷函数）
 */
function similarity(left: string, right: string): number {
  return similarityWithTokens(tokenize(left), tokenize(right));
}

/**
 * 分桶策略：按首词前缀分组
 * 减少需要比较的 cluster 数量
 */
function bucketByFirstWord(title: string): string {
  const firstWord = title.toLowerCase().split(/\s+/)[0] ?? "";
  return firstWord.slice(0, 3);
}

/**
 * 带预计算 tokens 的聚类项
 */
interface ClusterItem {
  id: string;
  normalizedTitle: string;
  finalScore: number;
  url?: string;
  summary?: string;
  tokens: Set<string>;
  bucket: string;
}

/**
 * 扩展的 Cluster 类型（包含 tokens 用于比较）
 */
interface ClusterWithTokens extends Cluster {
  _tokens?: Set<string>;
}

/**
 * 构建聚类（优化版）
 *
 * 优化策略：
 * 1. 分桶：按首词前缀分组，只比较同桶内的 cluster
 * 2. 预计算 tokens：避免重复分词
 * 3. 按分数排序：高分数的 item 优先成为 cluster 代表
 *
 * 性能：从 O(n²) 降到 O(n * k)，k 为平均桶大小
 */
export function buildClusters(
  items: Array<{ id: string; normalizedTitle: string; finalScore: number; url?: string; summary?: string }>,
  runId: string,
): Cluster[] {
  // 预处理：排序 + 预计算 tokens 和 bucket
  const sorted: ClusterItem[] = [...items]
    .sort((a, b) => b.finalScore - a.finalScore)
    .map((item) => ({
      ...item,
      tokens: tokenize(item.normalizedTitle),
      bucket: bucketByFirstWord(item.normalizedTitle),
    }));

  const clusters: ClusterWithTokens[] = [];

  // 桶索引：bucket → clusters[]
  const bucketIndex = new Map<string, ClusterWithTokens[]>();

  for (const item of sorted) {
    // 获取候选 clusters：同桶 + 前缀桶
    const candidates: ClusterWithTokens[] = [
      ...(bucketIndex.get(item.bucket) ?? []),
      ...(bucketIndex.get(item.bucket.slice(0, 2)) ?? []),
    ];

    // 在候选中查找相似 cluster
    let found = false;
    for (const cluster of candidates) {
      const clusterTokens = cluster._tokens ?? tokenize(cluster.title ?? "");
      if (cluster._tokens === undefined) {
        cluster._tokens = clusterTokens;
      }

      if (similarityWithTokens(clusterTokens, item.tokens) >= 0.74) {
        cluster.memberItemIds.push(item.id);
        found = true;
        break;
      }
    }

    if (!found) {
      // 创建新 cluster
      const newCluster: ClusterWithTokens = {
        id: `${runId}-${clusters.length + 1}`,
        runId,
        canonicalItemId: item.id,
        memberItemIds: [item.id],
        dedupeMethod: "near",
        title: item.normalizedTitle,
        summary: item.summary,
        url: item.url,
        _tokens: item.tokens,
      };
      clusters.push(newCluster);

      // 加入桶索引
      const bucketClusters = bucketIndex.get(item.bucket) ?? [];
      bucketClusters.push(newCluster);
      bucketIndex.set(item.bucket, bucketClusters);
    }
  }

  // 清理临时 tokens 字段
  return clusters.map(({ _tokens, ...rest }) => rest as Cluster);
}

// 导出 similarity 函数供测试使用
export { similarity };
