import { fileURLToPath } from 'node:url'

/** @type {import('next').NextConfig} */
const appRoot = fileURLToPath(new URL('.', import.meta.url))

const nextConfig = {
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
