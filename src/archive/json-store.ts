// src/archive/json-store.ts
import { readFile, writeFile, readdir, mkdir } from 'fs/promises'
import { join } from 'path'
import type { Article, ArticleStore } from './index'

interface DataFile {
  date: string
  collectedAt: string
  items: Article[]
  totalItems: number
}

export class JsonArticleStore implements ArticleStore {
  constructor(private dataDir: string = 'data') {}

  async save(date: string, items: Article[]): Promise<void> {
    const filePath = join(this.dataDir, `${date}.json`)
    const data: DataFile = {
      date,
      collectedAt: new Date().toISOString(),
      items,
      totalItems: items.length,
    }
    await mkdir(this.dataDir, { recursive: true })
    await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
  }

  async findAllByDate(date: string): Promise<Article[]> {
    const filePath = join(this.dataDir, `${date}.json`)
    try {
      const content = await readFile(filePath, 'utf-8')
      const data: DataFile = JSON.parse(content)
      return data.items ?? []
    } catch {
      return []
    }
  }

  async findByUrl(url: string): Promise<Article | null> {
    try {
      const files = await readdir(this.dataDir)
      for (const file of files) {
        if (!file.endsWith('.json')) continue
        const content = await readFile(join(this.dataDir, file), 'utf-8')
        const data: DataFile = JSON.parse(content)
        const found = data.items.find(item => item.url === url)
        if (found) return found
      }
    } catch {
      return null
    }
    return null
  }
}