import fs from 'fs'
import path from 'path'

export interface CollectedItem {
  id: string
  title: string
  url: string
  author?: string
  publishedAt: string
  kind: string
  content?: string
}

export interface SourceData {
  id: string
  name: string
  items: CollectedItem[]
}

export interface DailyData {
  date: string
  collectedAt: string
  sources: SourceData[]
  totalItems: number
}

export function writeDailyData(date: string, data: DailyData): void {
  const outputDir = path.resolve(process.cwd(), 'data')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const filePath = path.join(outputDir, `${date}.json`)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
  console.log(`Written: ${filePath}`)
}
