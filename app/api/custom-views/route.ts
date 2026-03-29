import { z } from "zod"

import { prisma } from "@/lib/prisma"
import { success, error, parseBody, validateBody, handlePrismaError, ParseError } from "@/lib/api-response"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Zod schema for CustomView creation
const customViewCreateSchema = z.object({
  id: z.string().min(1).optional(), // Optional - Prisma will generate CUID if not provided
  name: z.string().min(1),
  icon: z.string().min(1),
  description: z.string().nullable().optional(),
  filterJson: z.string().nullable().optional(),
  topicIds: z.array(z.string()).default([]),
})

export async function GET() {
  try {
    const views = await prisma.customView.findMany({
      include: {
        customViewPacks: {
          include: {
            pack: true,
          },
        },
      },
      orderBy: { order: "asc" },
    })

    // Transform to use topicIds instead of packIds in response
    const transformedViews = views.map((view) => ({
      id: view.id,
      name: view.name,
      icon: view.icon,
      description: view.description,
      filterJson: view.filterJson,
      order: view.order,
      topicIds: view.customViewPacks.map((cvp) => cvp.packId),
      customViewPacks: view.customViewPacks,
    }))

    return success({ views: transformedViews })
  } catch (err) {
    console.error("Error in /api/custom-views:", err)
    return error("Failed to load custom views")
  }
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await parseBody(request)
  } catch (e) {
    if (e instanceof ParseError) return error(e.message, e.status)
    throw e
  }

  const validated = validateBody(body, customViewCreateSchema)
  if (!validated.success) return validated.response
  const { data: parsedData } = validated

  try {
    const view = await prisma.customView.create({
      data: {
        ...(parsedData.id && { id: parsedData.id }),
        name: parsedData.name,
        icon: parsedData.icon,
        description: parsedData.description,
        filterJson: parsedData.filterJson,
        updatedAt: new Date(),
        customViewPacks: {
          create: parsedData.topicIds.map((topicId) => ({ packId: topicId })),
        },
      },
      include: {
        customViewPacks: {
          include: {
            pack: true,
          },
        },
      },
    })

    return success(view)
  } catch (err) {
    console.error("Error creating custom view:", err)

    const prismaErr = handlePrismaError(err, {
      p2002: "Custom view with this ID already exists",
      p2003: "One or more pack IDs do not exist",
    })
    if (prismaErr) return prismaErr

    return error("Failed to create custom view")
  }
}
