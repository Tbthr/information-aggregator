import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Zod schema for ProviderConfig validation
const providerConfigSchema = z.object({
  provider: z.enum(["anthropic", "gemini", "openai"]),
  model: z.string().min(1),
  baseUrl: z.string().url().nullable().optional(),
  apiKeyRef: z.string().nullable().optional(),
  extraConfig: z.string().nullable().optional(),
})

// GET: 获取所有 provider 配置
export async function GET() {
  try {
    const configs = await prisma.providerConfig.findMany({
      orderBy: { provider: "asc" },
    })

    // 隐藏敏感信息（不返回 apiKeyRef 的实际值）
    const safeConfigs = configs.map((c) => ({
      id: c.id,
      provider: c.provider,
      model: c.model,
      baseUrl: c.baseUrl,
      hasApiKey: !!c.apiKeyRef,
      updatedAt: c.updatedAt,
    }))

    return NextResponse.json({ success: true, data: safeConfigs })
  } catch (error) {
    console.error("Error fetching provider configs:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch provider configs" },
      { status: 500 }
    )
  }
}

// PUT: 更新 provider 配置
export async function PUT(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON in request body" },
      { status: 400 }
    )
  }

  const parsed = providerConfigSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid provider config data", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { provider, model, baseUrl, apiKeyRef, extraConfig } = parsed.data

  try {
    const config = await prisma.providerConfig.upsert({
      where: { provider },
      create: { provider, model, baseUrl, apiKeyRef, extraConfig },
      update: { model, baseUrl, apiKeyRef, extraConfig },
    })

    // 不返回 apiKeyRef
    const { apiKeyRef: _, ...safeConfig } = config

    return NextResponse.json({ success: true, data: safeConfig })
  } catch (error) {
    console.error("Error updating provider config:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update provider config" },
      { status: 500 }
    )
  }
}

// DELETE: 删除 provider 配置
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const provider = searchParams.get("provider")

  if (!provider) {
    return NextResponse.json(
      { success: false, error: "Provider parameter is required" },
      { status: 400 }
    )
  }

  try {
    await prisma.providerConfig.delete({
      where: { provider },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting provider config:", error)
    return NextResponse.json(
      { success: false, error: "Failed to delete provider config" },
      { status: 500 }
    )
  }
}
