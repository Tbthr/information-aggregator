import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { success, error, parseBody, ParseError } from "@/lib/api-response"
import { z } from "zod"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const dailyConfigSchema = z.object({
  packs: z.array(z.string()).optional(),
  maxItems: z.number().int().min(1).max(200).optional(),
  minScore: z.number().int().min(0).max(10).optional(),
  keywordBlacklist: z.array(z.string()).optional(),
  filterPrompt: z.string().optional(),
  topicPrompt: z.string().optional(),
  topicSummaryPrompt: z.string().optional(),
})

const weeklyConfigSchema = z.object({
  days: z
    .number()
    .int()
    .min(7)
    .max(28)
    .refine((v) => v % 7 === 0, { message: "必须为 7 的倍数" })
    .optional(),
  editorialPrompt: z.string().optional(),
  pickReasonPrompt: z.string().optional(),
  pickCount: z.number().int().min(1).max(20).optional(),
})

const updateSchema = z.object({
  daily: dailyConfigSchema.optional(),
  weekly: weeklyConfigSchema.optional(),
})

async function ensureDefaultConfigs() {
  // Note: Since prompts are now required in schema and stored in DB,
  // we don't auto-create configs here - they should already exist from migration
}

export async function GET() {
  await ensureDefaultConfigs()

  const [daily, weekly] = await Promise.all([
    prisma.dailyReportConfig.findUnique({ where: { id: "default" } }),
    prisma.weeklyReportConfig.findUnique({ where: { id: "default" } }),
  ])

  // Handle null packs array (null means no filter, treat as empty for API consistency)
  return success({
    daily: daily ? { ...daily, packs: daily.packs ?? [] } : null,
    weekly,
  })
}

export async function PUT(request: NextRequest) {
  let body: unknown
  try {
    body = await parseBody(request)
  } catch (e) {
    if (e instanceof ParseError) return error(e.message, e.status)
    throw e
  }

  const validation = updateSchema.safeParse(body)

  if (!validation.success) {
    return error("参数校验失败", 400, validation.error.flatten())
  }

  const { daily: dailyUpdate, weekly: weeklyUpdate } = validation.data

  if (dailyUpdate) {
    // Get existing config to fill in required prompt fields if not provided
    const existing = await prisma.dailyReportConfig.findUnique({ where: { id: "default" } })
    await prisma.dailyReportConfig.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        filterPrompt: dailyUpdate.filterPrompt ?? existing?.filterPrompt ?? "",
        topicPrompt: dailyUpdate.topicPrompt ?? existing?.topicPrompt ?? "",
        topicSummaryPrompt: dailyUpdate.topicSummaryPrompt ?? existing?.topicSummaryPrompt ?? "",
        packs: dailyUpdate.packs ?? existing?.packs ?? [],
        maxItems: dailyUpdate.maxItems ?? existing?.maxItems ?? 50,
        minScore: dailyUpdate.minScore ?? existing?.minScore ?? 0,
        keywordBlacklist: dailyUpdate.keywordBlacklist ?? existing?.keywordBlacklist ?? [],
      },
      update: {
        filterPrompt: dailyUpdate.filterPrompt,
        topicPrompt: dailyUpdate.topicPrompt,
        topicSummaryPrompt: dailyUpdate.topicSummaryPrompt,
        packs: dailyUpdate.packs,
        maxItems: dailyUpdate.maxItems,
        minScore: dailyUpdate.minScore,
        keywordBlacklist: dailyUpdate.keywordBlacklist,
      },
    })
  }

  if (weeklyUpdate) {
    const existing = await prisma.weeklyReportConfig.findUnique({ where: { id: "default" } })
    await prisma.weeklyReportConfig.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        editorialPrompt: weeklyUpdate.editorialPrompt ?? existing?.editorialPrompt ?? "",
        pickReasonPrompt: weeklyUpdate.pickReasonPrompt ?? existing?.pickReasonPrompt ?? "",
        days: weeklyUpdate.days ?? existing?.days ?? 7,
        pickCount: weeklyUpdate.pickCount ?? existing?.pickCount ?? 6,
      },
      update: {
        editorialPrompt: weeklyUpdate.editorialPrompt,
        pickReasonPrompt: weeklyUpdate.pickReasonPrompt,
        days: weeklyUpdate.days,
        pickCount: weeklyUpdate.pickCount,
      },
    })
  }

  const [daily, weekly] = await Promise.all([
    prisma.dailyReportConfig.findUnique({ where: { id: "default" } }),
    prisma.weeklyReportConfig.findUnique({ where: { id: "default" } }),
  ])

  return success({ daily, weekly })
}
