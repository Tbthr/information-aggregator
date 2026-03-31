/**
 * One-time migration: keywordBlacklist -> Topic.excludeRules
 *
 * This migration has already been run. The keywordBlacklist field was removed
 * from DailyReportConfig schema in a previous migration. This script is kept
 * for reference only and exits immediately.
 *
 * Run with: npx tsx scripts/migrate-keyword-blacklist.ts
 */

async function migrate() {
  console.log("=== keywordBlacklist -> Topic.excludeRules Migration ===\n")
  console.log("Migration already completed. The keywordBlacklist field has been removed from DailyReportConfig.")
  console.log("This script is kept for reference only.")
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
