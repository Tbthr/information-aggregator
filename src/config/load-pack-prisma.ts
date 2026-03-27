/**
 * Pack loader using Prisma (replaces YAML-based loading)
 *
 * This module provides the same interface as load-pack.ts but reads from
 * the Supabase database instead of YAML files.
 */

import { prisma } from "../../lib/prisma";
import type { InlineSource, SourcePack, SourceType } from "../types/index";

/**
 * Convert database Pack and Source records to SourcePack type
 */
function convertToSourcePack(
  packRecord: {
    id: string;
    name: string;
    description: string | null;
    mustInclude: string[];
    exclude: string[];
  },
  sourceRecords: Array<{
    id: string;
    type: string;
    url: string | null;
    description: string | null;
    enabled: boolean;
    configJson: string | null;
  }>
): SourcePack {
  const sources: InlineSource[] = sourceRecords.map((source) => {
    return {
      type: source.type as SourceType,
      url: source.url ?? '',
      description: source.description ?? undefined,
      enabled: source.enabled,
      configJson: source.configJson ?? undefined,
    };
  });

  return {
    id: packRecord.id,
    name: packRecord.name,
    description: packRecord.description ?? undefined,
    sources,
    mustInclude: packRecord.mustInclude,
    exclude: packRecord.exclude,
  };
}

/**
 * Load all packs from database with their sources
 */
export async function loadAllPacksFromDb(): Promise<SourcePack[]> {
  // Fetch all packs
  const packs = await prisma.pack.findMany({
    orderBy: { id: 'asc' },
  });

  // Fetch all sources with their pack associations
  const sources = await prisma.source.findMany({
    orderBy: [{ packId: 'asc' }, { name: 'asc' }],
  });

  // Group sources by pack
  const sourcesByPack = new Map<string, typeof sources>();
  for (const source of sources) {
    const packId = source.packId;
    if (!packId) continue;

    if (!sourcesByPack.has(packId)) {
      sourcesByPack.set(packId, []);
    }
    sourcesByPack.get(packId)!.push(source);
  }

  // Build SourcePack objects
  return packs.map((pack) => {
    const packSources = sourcesByPack.get(pack.id) ?? [];
    return convertToSourcePack(pack, packSources);
  });
}

/**
 * Load a single pack by ID from database
 */
export async function loadPackById(packId: string): Promise<SourcePack | null> {
  const pack = await prisma.pack.findUnique({
    where: { id: packId },
  });

  if (!pack) return null;

  const sources = await prisma.source.findMany({
    where: { packId: pack.id },
    orderBy: { name: 'asc' },
  });

  return convertToSourcePack(pack, sources);
}

/**
 * Load packs by IDs from database
 */
export async function loadPacksByIds(packIds: string[]): Promise<SourcePack[]> {
  if (packIds.length === 0) {
    return loadAllPacksFromDb();
  }

  const packs = await prisma.pack.findMany({
    where: { id: { in: packIds } },
    orderBy: { id: 'asc' },
  });

  const sources = await prisma.source.findMany({
    where: { packId: { in: packIds } },
    orderBy: [{ packId: 'asc' }, { name: 'asc' }],
  });

  const sourcesByPack = new Map<string, typeof sources>();
  for (const source of sources) {
    const packId = source.packId;
    if (!packId) continue;

    if (!sourcesByPack.has(packId)) {
      sourcesByPack.set(packId, []);
    }
    sourcesByPack.get(packId)!.push(source);
  }

  return packs.map((pack) => {
    const packSources = sourcesByPack.get(pack.id) ?? [];
    return convertToSourcePack(pack, packSources);
  });
}
