"use client"

import { useState, useEffect, useCallback } from "react"
import { Save, RotateCcw, X, Loader2, Newspaper, CalendarDays } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { useReportSettings, usePacks } from "@/hooks/use-api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { PageSkeleton } from "@/components/loading-skeletons"

// ── Types ──

interface DailyConfig {
  packs: string[]
  maxItems: number
  minScore: number
  keywordBlacklist: string[]
  filterPrompt: string
  topicPrompt: string
  topicSummaryPrompt: string
  pickReasonPrompt: string
  pickCount: number
}

interface WeeklyConfig {
  days: number
  editorialPrompt: string
  pickReasonPrompt: string
  pickCount: number
}

// ── Prompt Field ──

function PromptField({
  label,
  description,
  value,
  onChange,
  defaultValue,
}: {
  label: string
  description?: string
  value: string
  onChange: (value: string) => void
  defaultValue: string
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">{label}</Label>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange(defaultValue)}
          className="text-xs text-muted-foreground hover:text-foreground shrink-0"
        >
          <RotateCcw className="w-3 h-3 mr-1" />
          恢复默认
        </Button>
      </div>
      <div className="relative">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="输入 prompt 内容"
          className={`font-mono text-xs resize-y ${expanded ? "min-h-[240px]" : "min-h-[80px]"}`}
          rows={expanded ? 10 : 3}
        />
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="absolute bottom-2 right-2 text-xs text-muted-foreground hover:text-foreground"
        >
          {expanded ? "收起" : "展开"}
        </button>
      </div>
    </div>
  )
}

// ── Tag Input ──

function TagInput({
  tags,
  onChange,
  placeholder = "输入关键词后按 Enter 添加",
}: {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
}) {
  const [inputValue, setInputValue] = useState("")

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      const tag = inputValue.trim()
      if (tag && !tags.includes(tag)) {
        onChange([...tags, tag])
      }
      setInputValue("")
    }
  }

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag))
  }

  return (
    <div className="space-y-2">
      <Input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 pr-1">
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Number Field ──

function NumberField({
  label,
  description,
  value,
  onChange,
  min,
  max,
}: {
  label: string
  description?: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">
        {label}
        {description && (
          <span className="text-xs text-muted-foreground font-normal ml-1">
            ({description})
          </span>
        )}
      </Label>
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10)
          if (!isNaN(v) && v >= min && v <= max) {
            onChange(v)
          }
        }}
        className="w-32"
      />
    </div>
  )
}

// ── Main Component ──

export function ReportSettingsPage() {
  const { data: settings, isLoading, mutate } = useReportSettings()
  const { data: packs } = usePacks()

  const [daily, setDaily] = useState<DailyConfig>({
    packs: [],
    maxItems: 50,
    minScore: 0,
    keywordBlacklist: [],
    filterPrompt: "",
    topicPrompt: "",
    topicSummaryPrompt: "",
    pickReasonPrompt: "",
    pickCount: 3,
  })

  const [weekly, setWeekly] = useState<WeeklyConfig>({
    days: 7,
    editorialPrompt: "",
    pickReasonPrompt: "",
    pickCount: 6,
  })

  const [saving, setSaving] = useState(false)

  // Sync server data into local state
  useEffect(() => {
    if (settings?.daily) {
      const d = settings.daily as Record<string, unknown>
      setDaily((prev) => ({
        ...prev,
        packs: (d.packs as string[]) ?? prev.packs,
        maxItems: (d.maxItems as number) ?? prev.maxItems,
        minScore: (d.minScore as number) ?? prev.minScore,
        keywordBlacklist: (d.keywordBlacklist as string[]) ?? prev.keywordBlacklist,
        filterPrompt: (d.filterPrompt as string) ?? prev.filterPrompt,
        topicPrompt: (d.topicPrompt as string) ?? prev.topicPrompt,
        topicSummaryPrompt: (d.topicSummaryPrompt as string) ?? prev.topicSummaryPrompt,
        pickReasonPrompt: (d.pickReasonPrompt as string) ?? prev.pickReasonPrompt,
        pickCount: (d.pickCount as number) ?? prev.pickCount,
      }))
    }
    if (settings?.weekly) {
      const w = settings.weekly as Record<string, unknown>
      setWeekly((prev) => ({
        ...prev,
        days: (w.days as number) ?? prev.days,
        editorialPrompt: (w.editorialPrompt as string) ?? prev.editorialPrompt,
        pickReasonPrompt: (w.pickReasonPrompt as string) ?? prev.pickReasonPrompt,
        pickCount: (w.pickCount as number) ?? prev.pickCount,
      }))
    }
  }, [settings])

  const togglePack = useCallback((packId: string) => {
    setDaily((prev) => ({
      ...prev,
      packs: prev.packs.includes(packId)
        ? prev.packs.filter((id) => id !== packId)
        : [...prev.packs, packId],
    }))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/settings/reports", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          daily: {
            packs: daily.packs,
            maxItems: daily.maxItems,
            minScore: daily.minScore,
            keywordBlacklist: daily.keywordBlacklist,
            filterPrompt: daily.filterPrompt,
            topicPrompt: daily.topicPrompt,
            topicSummaryPrompt: daily.topicSummaryPrompt,
            pickReasonPrompt: daily.pickReasonPrompt,
            pickCount: daily.pickCount,
          },
          weekly: {
            days: weekly.days,
            editorialPrompt: weekly.editorialPrompt,
            pickReasonPrompt: weekly.pickReasonPrompt,
            pickCount: weekly.pickCount,
          },
        }),
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        toast({
          title: "保存失败",
          description: json.error || "未知错误",
          variant: "destructive",
        })
        return
      }

      toast({ title: "保存成功" })
      mutate(json.data)
    } catch {
      toast({
        title: "保存失败",
        description: "网络错误，请重试",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return <PageSkeleton />
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
      {/* Page header */}
      <div className="mb-2">
        <h1 className="text-xl font-semibold text-foreground">报告设置</h1>
        <p className="text-sm text-muted-foreground mt-1">
          配置日报和周报的生成参数与 AI Prompt
        </p>
      </div>

      {/* ── 日报配置 ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Newspaper className="w-4 h-4 text-primary" />
            <CardTitle className="text-base">日报配置</CardTitle>
          </div>
          <CardDescription>
            控制每日报告的数据源、过滤规则和 AI 生成参数
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 数据源 Pack 选择 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">数据源 Pack</Label>
            <p className="text-xs text-muted-foreground">
              选择用于日报数据收集的 Pack（不选则使用所有 Pack）
            </p>
            {packs && packs.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 mt-1">
                {packs.map((pack) => (
                  <label
                    key={pack.id}
                    className="flex items-center gap-2 text-sm cursor-pointer rounded-lg px-3 py-2 hover:bg-accent transition-colors"
                  >
                    <Checkbox
                      checked={daily.packs.includes(pack.id)}
                      onCheckedChange={() => togglePack(pack.id)}
                    />
                    <span className="truncate">{pack.name}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">暂无可用 Pack</p>
            )}
          </div>

          {/* 数值配置行 */}
          <div className="grid grid-cols-3 gap-4">
            <NumberField
              label="最大收集条目数"
              min={1}
              max={200}
              value={daily.maxItems}
              onChange={(v) => setDaily((prev) => ({ ...prev, maxItems: v }))}
            />
            <NumberField
              label="最低分数阈值"
              min={0}
              max={10}
              value={daily.minScore}
              onChange={(v) => setDaily((prev) => ({ ...prev, minScore: v }))}
            />
            <NumberField
              label="今日精选数量"
              min={1}
              max={10}
              value={daily.pickCount}
              onChange={(v) => setDaily((prev) => ({ ...prev, pickCount: v }))}
            />
          </div>

          {/* 关键词黑名单 */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">关键词黑名单</Label>
            <p className="text-xs text-muted-foreground">
              包含这些关键词的内容将被过滤掉
            </p>
            <TagInput
              tags={daily.keywordBlacklist}
              onChange={(tags) =>
                setDaily((prev) => ({ ...prev, keywordBlacklist: tags }))
              }
            />
          </div>

          {/* Prompt 区域 */}
          <div className="space-y-4 pt-2 border-t border-border">
            <h3 className="text-sm font-semibold text-foreground">AI Prompt</h3>

            <PromptField
              label="过滤 Prompt"
              description="可选，留空则跳过 AI 过滤步骤"
              value={daily.filterPrompt || ""}
              onChange={(v) =>
                setDaily((prev) => ({
                  ...prev,
                  filterPrompt: v,
                }))
              }
              defaultValue={""}
            />

            <PromptField
              label="话题聚类 Prompt"
              description="将内容按话题分组"
              value={daily.topicPrompt || ""}
              onChange={(v) =>
                setDaily((prev) => ({
                  ...prev,
                  topicPrompt: v,
                }))
              }
              defaultValue={""}
            />

            <PromptField
              label="话题总结 Prompt"
              description="为每个话题生成综合总结"
              value={daily.topicSummaryPrompt || ""}
              onChange={(v) =>
                setDaily((prev) => ({
                  ...prev,
                  topicSummaryPrompt: v,
                }))
              }
              defaultValue={""}
            />

            <PromptField
              label="精选理由 Prompt"
              description="为精选内容生成推荐理由"
              value={daily.pickReasonPrompt || ""}
              onChange={(v) =>
                setDaily((prev) => ({
                  ...prev,
                  pickReasonPrompt: v,
                }))
              }
              defaultValue={""}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── 周报配置 ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" />
            <CardTitle className="text-base">周报配置</CardTitle>
          </div>
          <CardDescription>
            控制每周报告的覆盖范围和 AI 生成参数
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 数值配置行 */}
          <div className="grid grid-cols-2 gap-4">
            <NumberField
              label="覆盖天数"
              description="7 的倍数"
              min={7}
              max={28}
              value={weekly.days}
              onChange={(v) => {
                if (v % 7 === 0) {
                  setWeekly((prev) => ({ ...prev, days: v }))
                }
              }}
            />
            <NumberField
              label="周报精选数量"
              min={1}
              max={20}
              value={weekly.pickCount}
              onChange={(v) => setWeekly((prev) => ({ ...prev, pickCount: v }))}
            />
          </div>

          {/* Prompt 区域 */}
          <div className="space-y-4 pt-2 border-t border-border">
            <h3 className="text-sm font-semibold text-foreground">AI Prompt</h3>

            <PromptField
              label="深度周总结 Prompt"
              description="基于本周各日话题生成深度总结"
              value={weekly.editorialPrompt || ""}
              onChange={(v) =>
                setWeekly((prev) => ({
                  ...prev,
                  editorialPrompt: v,
                }))
              }
              defaultValue={""}
            />

            <PromptField
              label="精选理由 Prompt"
              description="为周报精选内容生成推荐理由"
              value={weekly.pickReasonPrompt || ""}
              onChange={(v) =>
                setWeekly((prev) => ({
                  ...prev,
                  pickReasonPrompt: v,
                }))
              }
              defaultValue={""}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Save Button ── */}
      <div className="flex justify-end pb-8">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              保存设置
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
