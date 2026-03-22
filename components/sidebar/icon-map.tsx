import {
  Sun,
  BookOpen,
  Coffee,
  Zap,
  Bookmark,
  Settings,
  Rss,
  Code,
  Terminal,
  Cpu,
  Database,
  Music,
  Video,
  Camera,
  Image,
  MessageSquare,
  Mail,
  Bell,
  Compass,
  Map,
  Globe,
  Star,
  Heart,
  Flame,
  Sparkles,
  LucideIcon,
} from "lucide-react"

// 扩展图标映射（约 20 个图标）
export const ICON_MAP: Record<string, LucideIcon> = {
  // Productivity
  coffee: Coffee,
  zap: Zap,
  sun: Sun,
  book: BookOpen,
  bookmark: Bookmark,
  // Tech
  code: Code,
  terminal: Terminal,
  cpu: Cpu,
  database: Database,
  // Media
  music: Music,
  video: Video,
  camera: Camera,
  image: Image,
  // Communication
  message: MessageSquare,
  mail: Mail,
  bell: Bell,
  // Navigation
  compass: Compass,
  map: Map,
  globe: Globe,
  // Misc
  star: Star,
  heart: Heart,
  flame: Flame,
  sparkles: Sparkles,
  // Default
  settings: Settings,
  rss: Rss,
}

export function getIconComponent(iconName: string) {
  const Icon = ICON_MAP[iconName] || Zap
  return <Icon className="w-4 h-4 shrink-0" />
}
