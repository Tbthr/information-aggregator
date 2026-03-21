import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sourceId = searchParams.get("sourceId")

    if (!sourceId) {
      return NextResponse.json(
        { success: false, error: "sourceId is required" },
        { status: 400 }
      )
    }

    const config = await prisma.authConfig.findUnique({
      where: { sourceId },
    })

    if (!config) {
      return NextResponse.json({
        success: true,
        data: null,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        sourceId: config.sourceId,
        configJson: config.configJson || "",
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
    const { sourceId, configJson } = body

    if (!sourceId) {
      return NextResponse.json(
        { success: false, error: "sourceId is required" },
        { status: 400 }
      )
    }

    if (typeof configJson !== "string" || !configJson) {
      return NextResponse.json(
        { success: false, error: "configJson is required and must be a string" },
        { status: 400 }
      )
    }

    try {
      JSON.parse(configJson)
    } catch {
      return NextResponse.json(
        { success: false, error: "configJson must be valid JSON" },
        { status: 400 }
      )
    }

    const config = await prisma.authConfig.upsert({
      where: { sourceId },
      create: { sourceId, configJson },
      update: { configJson },
    })

    return NextResponse.json({
      success: true,
      data: {
        sourceId: config.sourceId,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to update auth config" },
      { status: 500 }
    )
  }
}
