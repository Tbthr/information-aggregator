import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const packId = searchParams.get("packId")

    if (!packId) {
      return NextResponse.json(
        { success: false, error: "packId is required" },
        { status: 400 }
      )
    }

    const config = await prisma.authConfig.findUnique({
      where: { packId },
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
    const { packId, adapter, configJson } = body

    if (!packId) {
      return NextResponse.json(
        { success: false, error: "packId is required" },
        { status: 400 }
      )
    }

    const config = await prisma.authConfig.upsert({
      where: { packId },
      create: { packId, adapter, configJson },
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
