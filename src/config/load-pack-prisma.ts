/**
 * Pack loader using Prisma (replaces YAML-based loading)
 *
 * This module provides the same interface as load-pack.ts but reads from
 * the Supabase database instead of YAML files.
 *
 * During migration (Task 3-9), this module supports both:
 * - Legacy Pack/Source model (Source.type, packId)
 * - New Topic/Content model (Source.kind, defaultTopicIds)
 */

import { prisma } from "../../lib/prisma";
import type { InlineSource, Topic, SourcePack, SourceKind } from "../types/index";

// Re-export legacy type alias for compatibility
export type { SourcePack };

/**
 * Legacy Source type (matches Prisma Source during migration)
 */
interface LegacySource {
  id: string;
  type: string;
  url: string | null;
  description: string | null;
  enabled: boolean;
  configJson: string | null;
  packId: string | null;
}

/**
 * Legacy Pack type (matches Prisma Pack during migration)
 */
interface LegacyPack {
  id: string;
  name: string;
  description: string | null;
  mustInclude: string[];
  exclude: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Convert database Source records to InlineSource (legacy Pack-based mapping)
 */
function convertToInlineSource(source: LegacySource): InlineSource {
  return {
    kind: (source.type || "rss") as SourceKind,
    url: source.url ?? "",
    description: source.description ?? undefined,
    enabled: source.enabled,
    configJson: source.configJson ?? undefined,
  };
}

/**
 * Load all packs from database with their sources (legacy Pack-based interface)
 */
export async function loadAllPacksFromDb(): Promise<SourcePack[]> {
  const packs = await prisma.pack.findMany({
    orderBy: { id: 'asc' },
  });

  const sources = await prisma.source.findMany({
    orderBy: [{ packId: 'asc' }, { name: 'asc' }],
  });

  const sourcesByPack = new Map<string, LegacySource[]>();
  for (const source of sources) {
    const packId = source.packId;
    if (!packId) continue;

    if (!sourcesByPack.has(packId)) {
      sourcesByPack.set(packId, []);
    }
    sourcesByPack.get(packId)!.push(source as unknown as LegacySource);
  }

  return packs.map((pack) => ({
    id: pack.id,
    name: pack.name,
    description: pack.description,
    mustInclude: pack.mustInclude,
    exclude: pack.exclude,
    createdAt: pack.createdAt,
    updatedAt: pack.updatedAt,
  }));
}

/**
 * Load a single pack by ID from database (legacy Pack-based interface)
 */
export async function loadPackById(packId: string): Promise<SourcePack | null> {
  const pack = await prisma.pack.findUnique({
    where: { id: packId },
  });

  if (!pack) return null;

  return {
    id: pack.id,
    name: pack.name,
    description: pack.description,
    mustInclude: pack.mustInclude,
    exclude: pack.exclude,
    createdAt: pack.createdAt,
    updatedAt: pack.updatedAt,
  };
}

/**
 * Load packs by IDs from database (legacy Pack-based interface)
 */
export async function loadPacksByIds(packIds: string[]): Promise<SourcePack[]> {
  if (packIds.length === 0) {
    return loadAllPacksFromDb();
  }

  const packs = await prisma.pack.findMany({
    where: { id: { in: packIds } },
    orderBy: { id: 'asc' },
  });

  return packs.map((pack) => ({
    id: pack.id,
    name: pack.name,
    description: pack.description,
    mustInclude: pack.mustInclude,
    exclude: pack.exclude,
    createdAt: pack.createdAt,
    updatedAt: pack.updatedAt,
  }));
}

/**
 * New Topic-based loader interfaces
 * These will be fully implemented in subsequent tasks
 */

export interface TopicWithSources extends Topic {
  sources: InlineSource[];
}

interface DbSource {
  id: string;
  kind: string;
  url: string | null;
  description: string | null;
  enabled: boolean;
  configJson: string | null;
  priority: number;
  defaultTopicIds: string[];
  authRef: string | null;
  packId: string | null;
}

interface DbPack {
  id: string;
  name: string;
  description: string | null;
  mustInclude: string[];
  exclude: string[];
}

/**
 * Convert database Source to InlineSource (new Topic-based mapping)
 */
function convertToInlineSourceNew(source: DbSource): InlineSource {
  return {
    kind: source.kind as SourceKind,
    url: source.url ?? "",
    description: source.description ?? undefined,
    enabled: source.enabled,
    configJson: source.configJson ?? undefined,
    priority: source.priority,
    defaultTopicIds: source.defaultTopicIds,
    authRef: source.authRef ?? undefined,
  };
}

/**
 * Load all topics from database with their sources (Topic-based interface)
 * Note: During migration, topics are stored as Packs in the database
 */
export async function loadAllTopicsFromDb(): Promise<TopicWithSources[]> {
  const packs = await prisma.pack.findMany({
    orderBy: { id: 'asc' },
  });

  const sources = await prisma.source.findMany({
    orderBy: [{ packId: 'asc' }, { name: 'asc' }],
  });

  const sourcesByPack = new Map<string, DbSource[]>();
  for (const source of sources) {
    const packId = source.packId;
    if (!packId) continue;

    if (!sourcesByPack.has(packId)) {
      sourcesByPack.set(packId, []);
    }
    sourcesByPack.get(packId)!.push(source as unknown as DbSource);
  }

  return packs.map((pack): TopicWithSources => {
    const packSources = sourcesByPack.get(pack.id) ?? [];
    return {
      id: pack.id,
      name: pack.name,
      description: pack.description ?? undefined,
      enabled: true,                  // Pack-based topics are always enabled
      includeRules: pack.mustInclude, // Pack.mustInclude maps to Topic.includeRules
      excludeRules: pack.exclude,     // Pack.exclude maps to Topic.excludeRules
      scoreBoost: 1.0,                // Default value
      displayOrder: 0,                // Default value
      maxItems: 10,                   // Default value
      sources: packSources.map(convertToInlineSourceNew),
    };
  });
}

/**
 * Load a single topic by ID from database (Topic-based interface)
 */
export async function loadTopicById(topicId: string): Promise<TopicWithSources | null> {
  const pack = await prisma.pack.findUnique({
    where: { id: topicId },
  });

  if (!pack) return null;

  const sources = await prisma.source.findMany({
    where: { packId: pack.id },
    orderBy: { name: 'asc' },
  });

  return {
    id: pack.id,
    name: pack.name,
    description: pack.description ?? undefined,
    enabled: true,
    includeRules: pack.mustInclude,
    excludeRules: pack.exclude,
    scoreBoost: 1.0,
    displayOrder: 0,
    maxItems: 10,
    sources: sources.map((s) => convertToInlineSourceNew(s as unknown as DbSource)),
  };
}

/**
 * Load topics by IDs from database (Topic-based interface)
 */
export async function loadTopicsByIds(topicIds: string[]): Promise<TopicWithSources[]> {
  if (topicIds.length === 0) {
    return loadAllTopicsFromDb();
  }

  const packs = await prisma.pack.findMany({
    where: { id: { in: topicIds } },
    orderBy: { id: 'asc' },
  });

  const sources = await prisma.source.findMany({
    where: { packId: { in: topicIds } },
    orderBy: [{ packId: 'asc' }, { name: 'asc' }],
  });

  const sourcesByPack = new Map<string, DbSource[]>();
  for (const source of sources) {
    const packId = source.packId;
    if (!packId) continue;

    if (!sourcesByPack.has(packId)) {
      sourcesByPack.set(packId, []);
    }
    sourcesByPack.get(packId)!.push(source as unknown as DbSource);
  }

  return packs.map((pack): TopicWithSources => {
    const packSources = sourcesByPack.get(pack.id) ?? [];
    return {
      id: pack.id,
      name: pack.name,
      description: pack.description ?? undefined,
      enabled: true,
      includeRules: pack.mustInclude,
      excludeRules: pack.exclude,
      scoreBoost: 1.0,
      displayOrder: 0,
      maxItems: 10,
      sources: packSources.map(convertToInlineSourceNew),
    };
  });
}
