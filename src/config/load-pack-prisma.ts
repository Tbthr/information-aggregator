/**
 * Topic loader using Prisma
 *
 * This module provides Topic/Source loading from the Supabase database.
 * Pack concept has been renamed to Topic.
 */

import { prisma } from "../../lib/prisma";
import type { InlineSource, Topic, SourceKind } from "../types/index";

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
}

/**
 * Convert database Source to InlineSource
 */
function convertToInlineSource(source: DbSource): InlineSource {
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
 * Load all topics from database with their sources
 */
export async function loadAllTopicsFromDb(): Promise<TopicWithSources[]> {
  const topics = await prisma.topic.findMany({
    orderBy: { id: 'asc' },
  });

  const sources = await prisma.source.findMany({
    orderBy: { name: 'asc' },
  });

  const sourcesByTopic = new Map<string, DbSource[]>();
  for (const source of sources) {
    const topicIds = source.defaultTopicIds;
    for (const topicId of topicIds) {
      if (!sourcesByTopic.has(topicId)) {
        sourcesByTopic.set(topicId, []);
      }
      sourcesByTopic.get(topicId)!.push(source as unknown as DbSource);
    }
  }

  return topics.map((topic): TopicWithSources => {
    const topicSources = sourcesByTopic.get(topic.id) ?? [];
    return {
      id: topic.id,
      name: topic.name,
      description: topic.description ?? undefined,
      enabled: topic.enabled,
      includeRules: topic.includeRules,
      excludeRules: topic.excludeRules,
      scoreBoost: topic.scoreBoost,
      displayOrder: topic.displayOrder,
      maxItems: topic.maxItems,
      sources: topicSources.map(convertToInlineSource),
    };
  });
}

/**
 * Load a single topic by ID from database
 */
export async function loadTopicById(topicId: string): Promise<TopicWithSources | null> {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
  });

  if (!topic) return null;

  const sources = await prisma.source.findMany({
    where: { defaultTopicIds: { hasSome: [topicId] } },
    orderBy: { name: 'asc' },
  });

  return {
    id: topic.id,
    name: topic.name,
    description: topic.description ?? undefined,
    enabled: topic.enabled,
    includeRules: topic.includeRules,
    excludeRules: topic.excludeRules,
    scoreBoost: topic.scoreBoost,
    displayOrder: topic.displayOrder,
    maxItems: topic.maxItems,
    sources: sources.map((s) => convertToInlineSource(s as unknown as DbSource)),
  };
}

/**
 * Load topics by IDs from database
 */
export async function loadTopicsByIds(topicIds: string[]): Promise<TopicWithSources[]> {
  if (topicIds.length === 0) {
    return loadAllTopicsFromDb();
  }

  const topics = await prisma.topic.findMany({
    where: { id: { in: topicIds } },
    orderBy: { id: 'asc' },
  });

  const sources = await prisma.source.findMany({
    where: { defaultTopicIds: { hasSome: topicIds } },
    orderBy: { name: 'asc' },
  });

  const sourcesByTopic = new Map<string, DbSource[]>();
  for (const source of sources) {
    for (const topicId of source.defaultTopicIds) {
      if (!sourcesByTopic.has(topicId)) {
        sourcesByTopic.set(topicId, []);
      }
      sourcesByTopic.get(topicId)!.push(source as unknown as DbSource);
    }
  }

  return topics.map((topic): TopicWithSources => {
    const topicSources = sourcesByTopic.get(topic.id) ?? [];
    return {
      id: topic.id,
      name: topic.name,
      description: topic.description ?? undefined,
      enabled: topic.enabled,
      includeRules: topic.includeRules,
      excludeRules: topic.excludeRules,
      scoreBoost: topic.scoreBoost,
      displayOrder: topic.displayOrder,
      maxItems: topic.maxItems,
      sources: topicSources.map(convertToInlineSource),
    };
  });
}
