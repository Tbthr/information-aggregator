/**
 * Pack loader using Prisma (replaces YAML-based loading)
 *
 * This module provides the same interface as load-pack.ts but reads from
 * the Supabase database instead of YAML files.
 */

import { prisma } from "../../lib/prisma";
import type { InlineSource, SourcePack, SourceType, PackPolicy, SourcePolicy, PolicyMode } from "../types/index";
import { CANONICAL_SOURCE_TYPES } from "../types/index";

const VALID_POLICY_MODES: PolicyMode[] = ['assist_only', 'filter_then_assist'];
const VALID_SOURCE_TYPES = new Set<SourceType>(CANONICAL_SOURCE_TYPES);

/**
 * Parse policy JSON string into PackPolicy object
 */
function parsePolicyJson(policyJson: string | null): PackPolicy | undefined {
  if (!policyJson) return undefined;

  try {
    const parsed = JSON.parse(policyJson);
    if (!parsed || typeof parsed !== 'object') return undefined;

    const mode = parsed.mode;
    if (!mode || !VALID_POLICY_MODES.includes(mode)) {
      return { mode: 'filter_then_assist' };
    }

    return {
      mode,
      filterPrompt: typeof parsed.filterPrompt === 'string' ? parsed.filterPrompt : undefined,
    };
  } catch {
    return undefined;
  }
}

/**
 * Convert database Pack and Source records to SourcePack type
 */
function convertToSourcePack(
  packRecord: { id: string; name: string; description: string | null; policyJson: string | null },
  sourceRecords: Array<{
    id: string;
    type: string;
    url: string | null;
    description: string | null;
    enabled: boolean;
    configJson: string | null;
  }>
): SourcePack {
  const packPolicy = parsePolicyJson(packRecord.policyJson);

  const sources: InlineSource[] = sourceRecords.map((source) => {
    // Build source policy - inherit from pack if not defined
    let sourcePolicy: SourcePolicy | undefined = packPolicy
      ? { ...packPolicy, inheritedFrom: 'pack' }
      : undefined;

    // Parse source-specific config for policy override
    if (source.configJson) {
      try {
        const config = JSON.parse(source.configJson);
        if (config.policy) {
          const parsedPolicy = parsePolicyJson(JSON.stringify(config.policy));
          if (parsedPolicy) {
            sourcePolicy = parsedPolicy;
          }
        }
      } catch {
        // Ignore parse errors
      }
    }

    return {
      type: source.type as SourceType,
      url: source.url ?? '',
      description: source.description ?? undefined,
      enabled: source.enabled,
      configJson: source.configJson ?? undefined,
      policy: sourcePolicy,
    };
  });

  return {
    id: packRecord.id,
    name: packRecord.name,
    description: packRecord.description ?? undefined,
    sources,
    policy: packPolicy,
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

// Re-export types and validation functions for backward compatibility
export { VALID_SOURCE_TYPES } from "./load-pack";
export { validateInlineSource, validateSourcePack, dedupePacksBySourceUrl } from "./load-pack";
