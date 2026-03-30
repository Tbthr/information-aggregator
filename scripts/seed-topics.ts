/**
 * Topic Seeding Script
 *
 * Seeds 6 preset topics and initializes DailyReportConfig.topicIds with all topic IDs.
 *
 * Preset topics:
 * - AI Agent: AI Agent 产品、工具和平台动态
 * - LLM: 大语言模型（LLM）技术、论文和评测
 * - 地缘冲突: 国际关系、地缘政治和冲突事件
 * - 科技趋势: 新兴技术、科技行业趋势和商业模式
 * - 商业财经: 商业、财经、投资和并购新闻
 * - AI产品: AI 产品发布、用户体验和产品更新
 *
 * Run with: npx tsx scripts/seed-topics.ts
 */

import { prisma } from "@/lib/prisma"

const PRESET_TOPICS = [
  {
    name: "AI Agent",
    description: "AI Agent 产品、工具和平台动态",
    excludeRules: [] as string[],
    includeRules: [] as string[],
    scoreBoost: 1.0,
    displayOrder: 0,
    maxItems: 10,
  },
  {
    name: "LLM",
    description: "大语言模型（LLM）技术、论文和评测",
    excludeRules: [] as string[],
    includeRules: [] as string[],
    scoreBoost: 1.0,
    displayOrder: 1,
    maxItems: 10,
  },
  {
    name: "地缘冲突",
    description: "国际关系、地缘政治和冲突事件",
    excludeRules: [] as string[],
    includeRules: [] as string[],
    scoreBoost: 1.0,
    displayOrder: 2,
    maxItems: 10,
  },
  {
    name: "科技趋势",
    description: "新兴技术、科技行业趋势和商业模式",
    excludeRules: [] as string[],
    includeRules: [] as string[],
    scoreBoost: 1.0,
    displayOrder: 3,
    maxItems: 10,
  },
  {
    name: "商业财经",
    description: "商业、财经、投资和并购新闻",
    excludeRules: [] as string[],
    includeRules: [] as string[],
    scoreBoost: 1.0,
    displayOrder: 4,
    maxItems: 10,
  },
  {
    name: "AI产品",
    description: "AI 产品发布、用户体验和产品更新",
    excludeRules: [] as string[],
    includeRules: [] as string[],
    scoreBoost: 1.0,
    displayOrder: 5,
    maxItems: 10,
  },
]

async function seedTopics() {
  console.log("=== Topic Seeding Script ===\n")

  const topicIds: string[] = []
  let created = 0
  let existing = 0

  for (const topic of PRESET_TOPICS) {
    const found = await prisma.topic.findUnique({
      where: { name: topic.name },
    })

    if (found) {
      existing++
      topicIds.push(found.id)
      console.log(`  [exists] Topic "${topic.name}" (id: ${found.id})`)
    } else {
      const createdTopic = await prisma.topic.create({
        data: {
          name: topic.name,
          description: topic.description,
          enabled: true,
          excludeRules: topic.excludeRules,
          includeRules: topic.includeRules,
          scoreBoost: topic.scoreBoost,
          displayOrder: topic.displayOrder,
          maxItems: topic.maxItems,
        },
      })
      created++
      topicIds.push(createdTopic.id)
      console.log(`  [created] Topic "${topic.name}" (id: ${createdTopic.id})`)
    }
  }

  console.log(`\nTopics: ${created} created, ${existing} already existed.`)

  // Initialize DailyReportConfig.topicIds with all 6 topic IDs
  const config = await prisma.dailyReportConfig.findUnique({
    where: { id: "default" },
  })

  if (config) {
    await prisma.dailyReportConfig.update({
      where: { id: "default" },
      data: { topicIds },
    })
    console.log(`\nDailyReportConfig.topicIds initialized with ${topicIds.length} topic IDs.`)
  } else {
    // Create config if it doesn't exist
    await prisma.dailyReportConfig.create({
      data: {
        id: "default",
        topicIds,
        maxItems: 50,
        minScore: 0,
        filterPrompt: "",
        topicPrompt: "",
        topicSummaryPrompt: "",
        kindPreferences: null,
      },
    })
    console.log(`\nDailyReportConfig created with topicIds: ${topicIds.join(", ")}`)
  }

  console.log("\nDone.")
}

seedTopics()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seeding failed:", err)
    process.exit(1)
  })
