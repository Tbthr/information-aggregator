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
  filterPrompt: z.string().nullable().optional(),
  topicPrompt: z.string().nullable().optional(),
  topicSummaryPrompt: z.string().nullable().optional(),
  pickReasonPrompt: z.string().nullable().optional(),
  pickCount: z.number().int().min(1).max(10).optional(),
})

const weeklyConfigSchema = z.object({
  days: z
    .number()
    .int()
    .min(7)
    .max(28)
    .refine((v) => v % 7 === 0, { message: "必须为 7 的倍数" })
    .optional(),
  editorialPrompt: z.string().nullable().optional(),
  pickReasonPrompt: z.string().nullable().optional(),
  pickCount: z.number().int().min(1).max(20).optional(),
})

const updateSchema = z.object({
  daily: dailyConfigSchema.optional(),
  weekly: weeklyConfigSchema.optional(),
})

async function ensureDefaultConfigs() {
  await Promise.all([
    prisma.dailyReportConfig.upsert({
      where: { id: "default" },
      create: { id: "default" },
      update: {},
    }),
    prisma.weeklyReportConfig.upsert({
      where: { id: "default" },
      create: { id: "default" },
      update: {},
    }),
  ])
}

export async function GET() {
  await ensureDefaultConfigs()

  const [daily, weekly] = await Promise.all([
    prisma.dailyReportConfig.findUnique({ where: { id: "default" } }),
    prisma.weeklyReportConfig.findUnique({ where: { id: "default" } }),
  ])

  return success({ daily, weekly })
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
    await prisma.dailyReportConfig.upsert({
      where: { id: "default" },
      create: { id: "default", ...dailyUpdate },
      update: dailyUpdate,
    })
  }

  if (weeklyUpdate) {
    await prisma.weeklyReportConfig.upsert({
      where: { id: "default" },
      create: { id: "default", ...weeklyUpdate },
      update: weeklyUpdate,
    })
  }

  const [daily, weekly] = await Promise.all([
    prisma.dailyReportConfig.findUnique({ where: { id: "default" } }),
    prisma.weeklyReportConfig.findUnique({ where: { id: "default" } }),
  ])

  return success({ daily, weekly })
}
