import { prisma } from "@/lib/prisma"
import { success, error } from "@/lib/api-response"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const content = await prisma.content.findUnique({
    where: { id },
  })

  if (!content) {
    return error("Content not found", 404)
  }

  return success({
    id: content.id,
    kind: content.kind,
    sourceId: content.sourceId,
    title: content.title,
    body: content.body,
    url: content.url,
    authorLabel: content.authorLabel,
    publishedAt: content.publishedAt?.toISOString() ?? null,
    fetchedAt: content.fetchedAt.toISOString(),
    engagementScore: content.engagementScore,
    qualityScore: content.qualityScore,
    topicIds: content.topicIds,
    topicScoresJson: content.topicScoresJson,
    metadataJson: content.metadataJson,
  })
}
