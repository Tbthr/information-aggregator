import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Zod schema for Settings validation
const settingsUpdateSchema = z.object({
  provider: z.string().optional(),
  batchSize: z.number().int().min(1).optional(),
  concurrency: z.number().int().min(1).optional(),
  maxRetries: z.number().int().min(0).optional(),
  initialDelay: z.number().int().min(0).optional(),
  maxDelay: z.number().int().min(0).optional(),
  backoffFactor: z.number().min(1).optional(),
})

export async function GET() {
  try {
    const settings = await prisma.settings.findUnique({
      where: { id: "default" },
    })

    if (!settings) {
      return NextResponse.json(
        { success: false, error: "Settings not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: settings,
    })
  } catch (error) {
    console.error("Error in /api/settings:", error)
    return NextResponse.json(
      { success: false, error: "Failed to load settings" },
      { status: 500 }
    )
  }
}

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

  const parsed = settingsUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid settings data", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    const settings = await prisma.settings.upsert({
      where: { id: "default" },
      update: { ...parsed.data, updatedAt: new Date() },
      create: { id: "default", ...parsed.data, updatedAt: new Date() },
    })

    return NextResponse.json({
      success: true,
      data: settings,
    })
  } catch (error) {
    console.error("Error updating settings:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update settings" },
      { status: 500 }
    )
  }
}
