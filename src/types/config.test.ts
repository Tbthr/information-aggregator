import { describe, expect, it } from 'bun:test'
import {
  AppConfigSchema,
  TagSchema,
  EnrichSchema,
  AiFlashSourceSchema,
  RankingSchema,
  DedupeSchema,
  ContentSchema,
} from './config'

describe('config schemas', () => {
  describe('TagSchema', () => {
    it('parses valid tag', () => {
      const tag = TagSchema.parse({
        id: 'ai',
        name: 'AI',
        enabled: true,
        includeRules: ['kimi', 'claude'],
        excludeRules: ['test'],
        scoreBoost: 1.5,
      })
      expect(tag.id).toBe('ai')
      expect(tag.scoreBoost).toBe(1.5)
    })

    it('applies defaults', () => {
      const tag = TagSchema.parse({ id: 'test', name: 'Test' })
      expect(tag.enabled).toBe(true)
      expect(tag.includeRules).toEqual([])
      expect(tag.scoreBoost).toBe(1.0)
    })

    it('rejects missing id', () => {
      expect(() => TagSchema.parse({ name: 'test' })).toThrow()
    })
  })

  describe('EnrichSchema', () => {
    it('parses valid enrich config', () => {
      const enrich = EnrichSchema.parse({
        enabled: true,
        batchSize: 5,
        minContentLength: 300,
        fetchTimeout: 15000,
      })
      expect(enrich.batchSize).toBe(5)
    })

    it('applies defaults', () => {
      const enrich = EnrichSchema.parse({})
      expect(enrich.enabled).toBe(true)
      expect(enrich.batchSize).toBe(10)
      expect(enrich.minContentLength).toBe(500)
      expect(enrich.fetchTimeout).toBe(20000)
    })
  })

  describe('AiFlashSourceSchema', () => {
    it('parses valid source', () => {
      const source = AiFlashSourceSchema.parse({
        id: 'hexi-1',
        adapter: 'hexi-daily',
        url: 'https://example.com/feed',
        enabled: true,
      })
      expect(source.id).toBe('hexi-1')
      expect(source.adapter).toBe('hexi-daily')
    })

    it('rejects invalid adapter', () => {
      expect(() =>
        AiFlashSourceSchema.parse({
          id: 'bad',
          adapter: 'invalid-adapter',
          url: 'https://example.com',
        }),
      ).toThrow()
    })
  })

  describe('RankingSchema', () => {
    it('applies defaults', () => {
      const ranking = RankingSchema.parse({})
      expect(ranking.sourceWeight).toBe(0.4)
      expect(ranking.engagement).toBe(0.15)
    })
  })

  describe('DedupeSchema', () => {
    it('applies defaults', () => {
      const dedupe = DedupeSchema.parse({})
      expect(dedupe.nearThreshold).toBe(0.75)
    })
  })

  describe('ContentSchema', () => {
    it('applies default truncation markers', () => {
      const content = ContentSchema.parse({})
      expect(content.truncationMarkers).toContain('[...]')
      expect(content.truncationMarkers).toContain('来源：')
    })
  })

  describe('AppConfigSchema', () => {
    it('parses full valid config', () => {
      const config = AppConfigSchema.parse({
        tags: [{ id: 'ai', name: 'AI' }, { id: 'news', name: 'News' }],
        enrich: { batchSize: 5 },
        aiFlashCategorization: { enabled: true },
        ranking: {},
        dedupe: {},
        content: {},
        aiFlashSources: [
          { id: 'hexi', adapter: 'hexi-daily', url: 'https://hexi.example.com' },
        ],
      })
      expect(config.tags).toHaveLength(2)
      expect(config.enrich.batchSize).toBe(5)
      expect(config.aiFlashSources[0].adapter).toBe('hexi-daily')
    })

    it('rejects missing required fields', () => {
      expect(() => AppConfigSchema.parse({ tags: [] })).toThrow()
    })
  })
})
