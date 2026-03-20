import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET
export async function GET() {
  try {
    const config = await prisma.authConfig.findUnique({
      where: { id: "default" },
    })

    if (!config) {
      return NextResponse.json({
        success: true,
        data: null,
      })
    }

    // 隐藏敏感配置
    return NextResponse.json({
      success: true,
      data: {
        id: config.id,
        adapter: config.adapter,
        hasConfig: !!config.configJson,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch auth config" },
      { status: 500 }
    )
  }
}

// PUT
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { adapter, configJson } = body

    const config = await prisma.authConfig.upsert({
      where: { id: "default" },
      create: { id: "default", adapter, configJson },
      update: { adapter, configJson },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: config.id,
        adapter: config.adapter,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to update auth config" },
      { status: 500 }
    )
  }
}
