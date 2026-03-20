#!/usr/bin/env npx tsx
/**
 * Migration Script: Add slug field to Source table
 *
 * This script preserves existing Source.id values as slug field
 * for backward compatibility during the cuid migration.
 *
 * Usage: npx tsx scripts/migrate-source-slugs.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function migrate() {
  console.log("Starting Source slug migration...");

  try {
    // Get all sources
    const sources = await prisma.source.findMany({
      select: { id: true, slug: true },
    });

    console.log(`Found ${sources.length} sources`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const source of sources) {
      // If slug already exists, skip
      if (source.slug) {
        console.log(`  [SKIP] Source ${source.id} already has slug: ${source.slug}`);
        skippedCount++;
        continue;
      }

      // Set slug to current id (preserving the old ID)
      await prisma.source.update({
        where: { id: source.id },
        data: { slug: source.id },
      });

      console.log(`  [MIGRATE] Source ${source.id} -> slug: ${source.id}`);
      migratedCount++;
    }

    console.log("\n=== Migration Summary ===");
    console.log(`Total sources: ${sources.length}`);
    console.log(`Migrated: ${migratedCount}`);
    console.log(`Skipped (already had slug): ${skippedCount}`);
    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
