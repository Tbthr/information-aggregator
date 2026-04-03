/**
 * Digest 处理模块
 *
 * 负责从 digest 类型来源（何夕2077、橘鸦AI早报）提取内容，
 * 通过 AI 进行分类+去重，最终生成要点列表。
 */

import type { AiClient } from '../ai/types.js'
import type { normalizedArticle } from '../types/index.js'
import type { DigestItem, DigestResult } from './types.js'

// ============================================================
// 提取 Digest 内容
// ============================================================

/**
 * 从 normalized articles 中提取 digest 来源的内容
 */
export function extractDigests(articles: normalizedArticle[]): DigestItem[] {
  return articles
    .filter(a => a.feedType === 'digest')
    .map(a => ({
      id: a.id,
      sourceId: a.sourceId,
      sourceName: a.sourceName ?? a.sourceId,
      title: a.normalizedTitle || a.title,
      content: a.normalizedContent || a.normalizedSummary || '',
      url: a.normalizedUrl || '',
      publishedAt: a.publishedAt,
    }))
}

// ============================================================
// AI 分类与去重
// ============================================================

/**
 * 构造发给 AI 的 prompt
 */
function buildDigestPrompt(digestPrompt: string, items: DigestItem[]): string {
  const sources = items.map(item => ({
    source: item.sourceName,
    title: item.title,
    content: item.content.slice(0, 3000), // 限制 token
  }))

  return `${digestPrompt}\n\n【原始内容】\n${JSON.stringify(sources, null, 2)}`
}

/**
 * 解析 AI 返回的 JSON，提取 DigestResult
 */
function parseDigestResult(raw: string): DigestResult | null {
  let text = raw.trim()

  // Try extracting from markdown code block first
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (codeBlockMatch) {
    text = codeBlockMatch[1]
  }

  try {
    const parsed = JSON.parse(text)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      Array.isArray(parsed.groups)
    ) {
      return {
        summary: parsed.summary ?? '',
        groups: parsed.groups.map((g: any) => ({
          topic: String(g.topic ?? '其他'),
          items: Array.isArray(g.items)
            ? g.items.map((item: any) => ({
                text: String(item.text ?? item),
                source: item.source ? String(item.source) : undefined,
              }))
            : [],
        })),
      }
    }
  } catch { /* ignore */ }

  return null
}

/**
 * 通过 AI 对 digest 内容进行分类和去重
 */
export async function classifyAndDedupDigests(
  items: DigestItem[],
  aiClient: AiClient,
  digestPrompt: string
): Promise<DigestResult> {
  if (items.length === 0) {
    return { summary: '', groups: [] }
  }

  const prompt = buildDigestPrompt(digestPrompt, items)

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const raw = await aiClient.generateText(prompt)
      const result = parseDigestResult(raw)
      if (result && result.groups.length > 0) {
        return result
      }
    } catch {
      // retry
    }
  }

  // Fallback: 返回原始内容的简单摘要
  return {
    summary: '今日 AI 快讯',
    groups: items.map(item => ({
      topic: item.sourceName,
      items: [{ text: item.title, source: item.sourceName }],
    })),
  }
}

// ============================================================
// Markdown 生成
// ============================================================

/**
 * 生成 Digest 部分的 Markdown
 */
export function generateDigestMarkdown(result: DigestResult): string {
  const lines: string[] = []

  if (result.summary) {
    lines.push(`> ${result.summary}`)
    lines.push('')
  }

  for (const group of result.groups) {
    lines.push(`### ${group.topic}`)
    lines.push('')
    for (const item of group.items) {
      const source = item.source ? ` (${item.source})` : ''
      lines.push(`- ${item.text}${source}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}
