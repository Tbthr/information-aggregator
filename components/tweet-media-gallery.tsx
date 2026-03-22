"use client"

import { useState } from "react"
import Image from "next/image"
import { Play } from "lucide-react"
import Lightbox from "yet-another-react-lightbox"
import "yet-another-react-lightbox/styles.css"

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
  if (count === 1) return "grid-cols-1"
  return "grid-cols-2 grid-rows-2"
}

function getSpanClass(index: number, total: number): string {
  if (total === 3 && index === 0) return "col-span-2 row-span-1"
  return ""
}

function getContainerClass(count: number): string {
  switch (count) {
    case 1: return ""
    case 2: return "h-56"
    default: return "h-72"
  }
}

export function TweetMediaGallery({ media, tweetUrl }: TweetMediaGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  if (!media || media.length === 0) return null

  const photos = media.filter((m) => m.type === "photo" || m.type === "animated_gif")
  const videos = media.filter((m) => m.type === "video")
  const displayItems = [...photos, ...videos].slice(0, MAX_DISPLAY)
  const overflow = [...photos, ...videos].length - MAX_DISPLAY

  if (displayItems.length === 0) return null

  // Lightbox slides: only photo/gif, exclude video
  const slides = displayItems
    .filter((m) => m.type !== "video")
    .map((m) => ({ src: getImageUrl(m) }))

  function openLightbox(index: number) {
    // Convert displayItems index to slides index (skip videos)
    let slideIndex = 0
    for (let i = 0; i < displayItems.length; i++) {
      if (displayItems[i].type === "video") continue
      if (i === index) {
        setLightboxIndex(slideIndex)
        break
      }
      slideIndex++
    }
    setLightboxOpen(true)
  }

  const isSingle = displayItems.length === 1

  return (
    <>
      <div
        className={`grid ${getGridClass(displayItems.length)} gap-0.5 mb-3 rounded-lg overflow-hidden ${getContainerClass(displayItems.length)}`}
      >
        {displayItems.map((item, index) => {
          const isVideo = item.type === "video"
          const isGif = item.type === "animated_gif"
          const imgUrl = getImageUrl(item)

          return (
            <div
              key={`${item.url}-${index}`}
              className={`relative ${getSpanClass(index, displayItems.length)} ${isSingle ? "" : "h-full overflow-hidden"}`}
              style={isSingle ? { maxHeight: 300, aspectRatio: item.width && item.height ? `${item.width}/${item.height}` : "16/9" } : undefined}
            >
              {isVideo ? (
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
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center">
                      <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                    </div>
                  </div>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => openLightbox(index)}
                  className="block w-full h-full cursor-pointer"
                >
                  <Image
                    src={imgUrl}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 600px"
                    loading="lazy"
                  />
                  {isGif && (
                    <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] font-medium pointer-events-none">
                      GIF
                    </div>
                  )}
                </button>
              )}
              {overflow > 0 && index === displayItems.length - 1 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-2xl font-bold pointer-events-none">
                  +{overflow}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {slides.length > 0 && (
        <Lightbox
          open={lightboxOpen}
          close={() => setLightboxOpen(false)}
          index={lightboxIndex}
          slides={slides}
        />
      )}
    </>
  )
}
