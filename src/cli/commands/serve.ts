import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import * as url from 'url'

const __dirname = url.fileURLToPath(new URL('.', import.meta.url))

interface ServeOptions {
  port?: string
  reports?: string
}

export async function serve(options: ServeOptions): Promise<void> {
  const port = parseInt(options.port ?? '3000')
  const reportsDir = options.reports ?? path.resolve(process.cwd(), 'reports')

  // 扫描 reports/daily/ 和 reports/weekly/
  const dailyFiles = fs.readdirSync(path.join(reportsDir, 'daily'))
    .filter(f => f.endsWith('.md'))
    .sort()
    .reverse()

  const weeklyFiles = fs.readdirSync(path.join(reportsDir, 'weekly'))
    .filter(f => f.endsWith('.md'))
    .sort()
    .reverse()

  // 注入索引数据到 index.html
  const indexPath = path.resolve(process.cwd(), 'serve', 'index.html')
  let html = fs.readFileSync(indexPath, 'utf-8')

  // 注入配置
  html = html.replace(
    '</body>',
    `<script>window.__REPORTS_CONFIG = ${JSON.stringify({ dailyFiles, weeklyFiles })};</script></body>`
  )

  const server = http.createServer((req, res) => {
    const pathname = url.parse(req.url!).pathname!

    if (pathname === '/' || pathname === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(html)
      return
    }

    // 代理 Markdown 文件请求
    const filePath = path.join(process.cwd(), pathname)
    if (fs.existsSync(filePath) && filePath.endsWith('.md')) {
      res.writeHead(200, { 'Content-Type': 'text/markdown' })
      res.end(fs.readFileSync(filePath, 'utf-8'))
      return
    }

    res.writeHead(404)
    res.end('Not found')
  })

  server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`)
    console.log(`Daily reports: ${dailyFiles.length} files`)
    console.log(`Weekly reports: ${weeklyFiles.length} files`)
  })
}