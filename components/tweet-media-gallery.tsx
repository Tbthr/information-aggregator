"use client"

import Image from "next/image"
import { Play } from "lucide-react"

interface MediaItem {
  type: "photo" | "video" | "animated_gif"
  url: string
  width?: number
  height?: number
  previewUrl?: string
}

interface TweetMediaGalleryProps {
  media: MediaItem[]
  tweetUrl?: string
}

const MAX_DISPLAY = 4

function getImageUrl(item: MediaItem): string {
  if (item.type === "video") {
    return item.previewUrl || item.url
  }
  return item.url
}

function getGridClass(count: number): string {
  return count === 1 ? "grid-cols-1" : "grid-cols-2"
}

function getSpanClass(index: number, total: number): string {
  if (total === 3 && index === 0) return "col-span-2"
  return ""
}

function getAspectRatio(item: MediaItem): number {
  if (item.width && item.height) {
    return item.width / item.height
  }
  return 16 / 9
}

export function TweetMediaGallery({ media, tweetUrl }: TweetMediaGalleryProps) {
  if (!media || media.length === 0) return null

  const photos = media.filter((m) => m.type === "photo" || m.type === "animated_gif")
  const videos = media.filter((m) => m.type === "video")
  const displayItems = [...photos, ...videos].slice(0, MAX_DISPLAY)
  const overflow = [...photos, ...videos].length - MAX_DISPLAY

  if (displayItems.length === 0) return null

  return (
    <div className={`grid ${getGridClass(displayItems.length)} gap-0.5 mb-3 rounded-lg overflow-hidden`}>
      {displayItems.map((item, index) => {
        const isVideo = item.type === "video"
        const isGif = item.type === "animated_gif"
        const imgUrl = getImageUrl(item)
        const aspectRatio = getAspectRatio(item)
        const isSingle = displayItems.length === 1
        const containerHeight = isSingle ? 300 : 180

        return (
          <div
            key={`${item.url}-${index}`}
            className={`relative ${getSpanClass(index, displayItems.length)}`}
            style={{
              maxHeight: containerHeight,
              aspectRatio: isSingle ? aspectRatio : "1",
            }}
          >
            <a
              href={tweetUrl || item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full h-full"
            >
              <Image
                src={imgUrl}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 600px"
                loading="lazy"
              />
              {isVideo && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center">
                    <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                  </div>
                </div>
              )}
              {isGif && (
                <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] font-medium">
                  GIF
                </div>
              )}
              {overflow > 0 && index === displayItems.length - 1 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-2xl font-bold">
                  +{overflow}
                </div>
              )}
            </a>
          </div>
        )
      })}
    </div>
  )
}
