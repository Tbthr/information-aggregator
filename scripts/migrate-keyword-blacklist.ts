/**
 * One-time migration: keywordBlacklist -> Topic.excludeRules
 *
 * Reads DailyReportConfig.keywordBlacklist and converts each keyword into
 * a Topic with excludeRules containing that keyword, then clears the blacklist.
 *
 * Run with: npx tsx scripts/migrate-keyword-blacklist.ts
 */

import { prisma } from "@/lib/prisma"

async function migrate() {
  console.log("=== keywordBlacklist -> Topic.excludeRules Migration ===\n")

  // 1. Read current keywordBlacklist
  const config = await prisma.dailyReportConfig.findUnique({
    where: { id: "default" },
  })

  if (!config) {
    console.log("No DailyReportConfig found. Nothing to migrate.")
    return
  }

  const { keywordBlacklist } = config
  if (!keywordBlacklist || keywordBlacklist.length === 0) {
    console.log("keywordBlacklist is empty. Nothing to migrate.")
    return
  }

  console.log(`Found ${keywordBlacklist.length} keyword(s) in blacklist: ${keywordBlacklist.join(", ")}\n`)

  let created = 0
  let updated = 0

  // 2. For each keyword, upsert a Topic with excludeRules
  for (const keyword of keywordBlacklist) {
    const topicName = `黑名单:${keyword}`

    const existing = await prisma.topic.findUnique({
      where: { name: topicName },
    })

    if (existing) {
      // Append keyword to existing excludeRules if not already present
      const newExcludeRules = existing.excludeRules.includes(keyword)
        ? existing.excludeRules
        : [...existing.excludeRules, keyword]

      await prisma.topic.update({
        where: { id: existing.id },
        data: { excludeRules: newExcludeRules },
      })
      updated++
      console.log(`  [updated] Topic "${topicName}" - added excludeRule: "${keyword}"`)
    } else {
      await prisma.topic.create({
        data: {
          name: topicName,
          description: `由关键词黑名单迁移生成`,
          enabled: true,
          excludeRules: [keyword],
          includeRules: [],
          scoreBoost: 1.0,
          displayOrder: 999,
          maxItems: 10,
        },
      })
      created++
      console.log(`  [created] Topic "${topicName}" with excludeRule: "${keyword}"`)
    }
  }

  // 3. Clear keywordBlacklist on DailyReportConfig
  await prisma.dailyReportConfig.update({
    where: { id: "default" },
    data: { keywordBlacklist: [] },
  })

  console.log(`\nMigration complete:`)
  console.log(`  Topics created: ${created}`)
  console.log(`  Topics updated: ${updated}`)
  console.log(`  keywordBlacklist cleared.`)
}

migrate()
  .then(() => {
    console.log("\nDone.")
    process.exit(0)
  })
  .catch((err) => {
    console.error("Migration failed:", err)
    process.exit(1)
  })
