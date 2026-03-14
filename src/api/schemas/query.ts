import { z } from "zod";

// 时间窗口枚举
export const WindowSchema = z.enum(["1h", "6h", "24h", "7d", "30d", "all"]);

// 排序方式枚举
export const SortSchema = z.enum(["score", "recent", "engagement"]);

// Items 查询参数 schema
export const ItemsQuerySchema = z.object({
  packs: z.string().optional(),           // 逗号分隔的 pack IDs
  window: WindowSchema.default("24h"),    // 时间窗口
  sources: z.string().optional(),         // 逗号分隔的 source IDs
  sourceTypes: z.string().optional(),     // 逗号分隔的 source types
  sort: SortSchema.default("score"),      // 排序方式
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),          // 全文搜索
  minScore: z.coerce.number().min(0).max(10).optional(),
});

export type ItemsQuery = z.infer<typeof ItemsQuerySchema>;

// Packs 查询参数 schema
export const PacksQuerySchema = z.object({
  includeStats: z.coerce.boolean().default(false),
});

export type PacksQuery = z.infer<typeof PacksQuerySchema>;
