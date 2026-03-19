import { fileURLToPath } from 'node:url'

/** @type {import('next').NextConfig} */
const appRoot = fileURLToPath(new URL('.', import.meta.url))

const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: '/app/api/:path*',
      },
    ]
  },
  turbopack: {
    root: appRoot,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
}

export default nextConfig
