import { Rss, Globe, Flame, MessageSquare, Bookmark, Heart, Github, FileJson, List } from "lucide-react"
import type { LucideIcon } from "lucide-react"

export const SOURCE_TYPE_CATEGORIES: Array<{ label: string; types: Array<{ value: string; label: string; icon: LucideIcon | string }> }> = [
  {
    label: "RSS & Feeds",
    types: [
      { value: "rss", label: "RSS Feed", icon: Rss },
      { value: "json-feed", label: "JSON Feed", icon: FileJson },
    ],
  },
  {
    label: "Web",
    types: [
      { value: "website", label: "Website", icon: Globe },
      { value: "hn", label: "Hacker News", icon: Flame },
      { value: "reddit", label: "Reddit", icon: MessageSquare },
    ],
  },
  {
    label: "Social",
    types: [
      { value: "x-home", label: "X Home", icon: "X" },
      { value: "x-list", label: "X List", icon: List },
      { value: "x-bookmarks", label: "X Bookmarks", icon: Bookmark },
      { value: "x-likes", label: "X Likes", icon: Heart },
    ],
  },
  {
    label: "Dev",
    types: [
      { value: "github-trending", label: "GitHub Trending", icon: Github },
    ],
  },
]
