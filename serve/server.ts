// Simple static file server for The Daily Brief
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync, readFileSync, readdirSync, statSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const PORT = 3000

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    let url = new URL(req.url).pathname

    // Default to index.html
    if (url === '/') url = '/serve/index.html'

    const filePath = join(ROOT, url)

    // Security: prevent directory traversal
    if (!filePath.startsWith(ROOT)) {
      return new Response('Forbidden', { status: 403 })
    }

    if (!existsSync(filePath)) {
      return new Response('Not Found', { status: 404 })
    }

    const stat = statSync(filePath)
    if (stat && stat.isDirectory()) {
      // Try index.html in directory
      const indexPath = join(filePath, 'index.html')
      if (existsSync(indexPath)) {
        const file = readFileSync(indexPath)
        return new Response(file, { headers: { 'Content-Type': 'text/html' } })
      }
      // Directory listing
      const files = readdirSync(filePath)
      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${url}</title></head>
<body><h1>${url}</h1><ul>
${files.map(f => `<li><a href="${url}/${f}">${f}</a></li>`).join('')}
</ul></body></html>`
      return new Response(html, { headers: { 'Content-Type': 'text/html' } })
    }

    const ext = '.' + (filePath.split('.').pop() || '')
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'

    const file = readFileSync(filePath)
    return new Response(file, {
      headers: { 'Content-Type': contentType }
    })
  },
})

console.log(`Server running at http://localhost:${PORT}`)
