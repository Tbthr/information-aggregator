import type { RawItem, Source } from "../types/index";
import { createLogger, maskSensitiveArgs, truncateWithLength } from "../utils/logger";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { computeTimeCutoff } from "../../lib/utils";
import { cleanMarkdownTitle } from "../../lib/clean-title.js";

const logger = createLogger("adapter:bird");

type BirdMode = 'home' | 'bookmarks' | 'likes' | 'list' | 'user-tweets' | 'search' | 'news' | 'trending';

const DEBUG_BIRD_OUTPUT = process.env.DEBUG_BIRD_OUTPUT === "true";
const DEBUG_OUTPUT_DIR = "out/bird-raw";

function saveDebugOutput(sourceId: string, rawOutput: string): void {
  if (!DEBUG_BIRD_OUTPUT) {
    return;
  }

  try {
    mkdirSync(DEBUG_OUTPUT_DIR, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `${sourceId}_${timestamp}.json`;
    const filepath = join(DEBUG_OUTPUT_DIR, filename);
    writeFileSync(filepath, rawOutput, "utf-8");
    logger.info("Saved bird CLI raw output", { filepath, size: rawOutput.length });
  } catch (err) {
    logger.warn("Failed to save debug output", { error: String(err) });
  }
}

interface BirdSourceConfig {
  birdMode?: BirdMode;
  listId?: string;
  count?: number;
  fetchAll?: boolean;
  maxPages?: number;
  authToken?: string;
  ct0?: string;
  chromeProfile?: string;
  chromeProfileDir?: string;
  cookieSource?: string[];
  cookieTimeoutMs?: number;
  // 新增字段
  username?: string;  // user-tweets 用
  query?: string;     // search 用
}

interface BirdMedia {
  type?: "photo" | "video" | "animated_gif";
  url?: string;
  width?: number;
  height?: number;
  previewUrl?: string;
}

interface BirdAuthor {
  username?: string;
  name?: string;
}

interface BirdArticle {
  title?: string;
  previewText?: string;
  url?: string;
}

interface BirdQuote {
  id?: string;
  text?: string;
  author?: string | BirdAuthor;
  url?: string;
}

interface BirdThreadItem {
  id?: string;
  text?: string;
  author?: string | BirdAuthor;
  createdAt?: string;
}

/**
 * Bird CLI 返回的推文数据结构
 *
 * 字段用途说明：
 * - id: 推文唯一标识，用于生成 URL 和去重
 * - text: 推文正文，用于摘要和显示
 * - author.username: 作者用户名，用于显示和引用
 * - author.name: 作者显示名，比用户名更友好
 * - authorId: 作者唯一标识，用于追踪
 * - createdAt: 发布时间，用于排序和时间窗口过滤
 * - likeCount/replyCount/retweetCount: 互动数据，用于热度排序
 * - conversationId: 对话 ID，用于关联同一对话的推文
 * - media: 媒体附件（图片/视频/GIF）
 * - article: 外链文章预览（标题和摘要）
 * - quote: 引用的推文
 * - parent: 回复的父推文
 * - thread: 长文线程（连续推文）
 * - expandedUrl: 展开的外链 URL（t.co 解析后）
 */
interface BirdItem {
  id?: string;
  text?: string;
  url?: string;
  expandedUrl?: string;
  expanded_url?: string;
  authorId?: string;
  author?: string | BirdAuthor;
  article?: BirdArticle;
  createdAt?: string;
  created_at?: string;
  likeCount?: number;
  replyCount?: number;
  retweetCount?: number;
  conversationId?: string;
  media?: BirdMedia[];
  quote?: BirdQuote;
  parent?: BirdThreadItem;
  thread?: BirdThreadItem[];
}

function normalizeBirdTitle(text: string): string {
  const firstLine = text.split("\n").map((line) => line.trim()).find((line) => line !== "") ?? text.trim();
  const withoutUrls = firstLine.replace(/https?:\/\/\S+/g, "").trim();
  const cleaned = cleanMarkdownTitle(withoutUrls);
  return cleaned.length > 120 ? `${cleaned.slice(0, 117).trimEnd()}...` : cleaned;
}

function getBirdConfig(source: Pick<Source, "authConfigJson">): BirdSourceConfig {
  return JSON.parse(source.authConfigJson ?? "{}") as BirdSourceConfig;
}

function getBirdAuthArgs(config: BirdSourceConfig): string[] {
  const authToken = config.authToken;
  const ct0 = config.ct0;
  const args: string[] = [];

  if (authToken && ct0) {
    args.push("--auth-token", authToken, "--ct0", ct0);
  } else {
    if (config.chromeProfile) {
      args.push("--chrome-profile", config.chromeProfile);
    }
    if (config.chromeProfileDir) {
      args.push("--chrome-profile-dir", config.chromeProfileDir);
    }
    // cookieSource 可能是字符串或数组，统一处理为数组
    const cookieSources = Array.isArray(config.cookieSource)
      ? config.cookieSource
      : config.cookieSource
        ? [config.cookieSource]
        : [];
    for (const source of cookieSources) {
      args.push("--cookie-source", source);
    }
    if (typeof config.cookieTimeoutMs === "number") {
      args.push("--cookie-timeout", String(config.cookieTimeoutMs));
    }
  }

  return args;
}

function getBirdMode(source: Pick<Source, "authConfigJson">): string {
  const mode = getBirdConfig(source).birdMode;
  if (!mode) {
    throw new Error("x source requires birdMode");
  }

  return mode;
}

function getCountArgs(config: BirdSourceConfig, mode: string): string[] {
  const args: string[] = [];

  // --all 仅支持 list/bookmarks/likes，不支持 home
  if (config.fetchAll && mode !== "home") {
    args.push("--all");
    if (config.maxPages) {
      args.push("--max-pages", String(config.maxPages));
    }
  } else if (config.count) {
    args.push("-n", String(config.count));
  }

  return args;
}

export function buildBirdCommand(source: Pick<Source, "type" | "authConfigJson">): string[] {
  const config = getBirdConfig(source);
  const mode = getBirdMode(source);
  const authArgs = getBirdAuthArgs(config);
  const countArgs = getCountArgs(config, mode);

  if (mode === "home" || mode === "bookmarks" || mode === "likes") {
    return ["bird", ...authArgs, mode, ...countArgs, "--json"];
  }

  if (mode === "list") {
    if (!config.listId) {
      throw new Error("x list source requires listId");
    }

    return ["bird", ...authArgs, "list-timeline", config.listId, ...countArgs, "--json"];
  }

  // 新增: user-tweets 模式
  if (mode === "user-tweets") {
    if (!config.username) {
      throw new Error("x user-tweets source requires username");
    }
    return ["bird", ...authArgs, "user-tweets", config.username, ...countArgs, "--json"];
  }

  // 新增: search 模式
  if (mode === "search") {
    if (!config.query) {
      throw new Error("x search source requires query");
    }
    return ["bird", ...authArgs, "search", config.query, ...countArgs, "--json"];
  }

  // 新增: news/trending 模式
  if (mode === "news" || mode === "trending") {
    return ["bird", ...authArgs, "news", ...countArgs, "--json"];
  }

  throw new Error(`Unsupported birdMode: ${mode}`);
}

function extractAuthorUsername(author: string | BirdAuthor | undefined): string | undefined {
  if (typeof author === "string") {
    return author;
  }
  return author?.username;
}

function buildArticleMetadata(article: BirdArticle | undefined): { title: string; previewText?: string; url?: string } | undefined {
  if (!article || (!article.title && !article.previewText && !article.url)) {
    return undefined;
  }
  return {
    title: article.title ?? "",
    previewText: article.previewText,
    url: article.url,
  };
}

type MediaType = "photo" | "video" | "animated_gif";

function buildMediaMetadata(media: BirdMedia[] | undefined): { type: MediaType; url: string; width?: number; height?: number; previewUrl?: string }[] | undefined {
  if (!media || media.length === 0) {
    return undefined;
  }
  return media
    .filter((m) => m.type && m.url)
    .map((m) => ({
      type: m.type as MediaType,
      url: m.url as string,
      width: m.width,
      height: m.height,
      previewUrl: m.previewUrl,
    }));
}

function buildQuoteMetadata(quote: BirdQuote | undefined): { id?: string; text?: string; author?: string; url?: string } | undefined {
  if (!quote || !quote.id) {
    return undefined;
  }
  return {
    id: quote.id,
    text: quote.text,
    author: extractAuthorUsername(quote.author),
    url: quote.url,
  };
}

function buildThreadMetadata(thread: BirdThreadItem[] | undefined): { id?: string; text?: string; author?: string }[] | undefined {
  if (!thread || thread.length === 0) {
    return undefined;
  }
  return thread.map((t) => ({
    id: t.id,
    text: t.text,
    author: extractAuthorUsername(t.author),
  }));
}

function buildParentMetadata(parent: BirdThreadItem | undefined): { id?: string; text?: string; author?: string } | undefined {
  if (!parent || !parent.id) {
    return undefined;
  }
  return {
    id: parent.id,
    text: parent.text,
    author: extractAuthorUsername(parent.author),
  };
}

function parseBirdItems(payload: string, source: Source, jobStartedAt: string, timeWindow: number): { items: RawItem[], discardNoTimestamp: number, discardOutsideWindow: number } {
  let parsed: BirdItem[] | { tweets: BirdItem[] };
  try {
    parsed = JSON.parse(payload) as BirdItem[] | { tweets: BirdItem[] };
  } catch (err) {
    logger.error("Failed to parse bird CLI JSON output", { error: String(err), payloadPreview: payload.slice(0, 500) });
    return { items: [], discardNoTimestamp: 0, discardOutsideWindow: 0 };
  }
  // --all 参数会返回 {"tweets": [...]} 结构，需要提取 tweets 数组
  const items = Array.isArray(parsed) ? parsed : (parsed as { tweets: BirdItem[] }).tweets;
  if (!Array.isArray(items)) {
    throw new Error("bird CLI output must be a JSON array or {tweets: [...]}");
  }

  let discardNoTimestamp = 0;
  let discardOutsideWindow = 0;
  const cutoffTimestamp = computeTimeCutoff(jobStartedAt, timeWindow);

  const result = items
    .filter((item) => typeof item.text === "string")
    .map((item, index) => {
      const rawText = item.text ?? `Post ${index + 1}`;
      const article = item.article;
      const title = typeof article?.title === "string" && article.title.trim() !== ""
        ? article.title.trim()
        : normalizeBirdTitle(rawText);
      const authorUsername = extractAuthorUsername(item.author);
      const authorName = typeof item.author === "object" && item.author !== null ? item.author.name : undefined;

      // Check 24h window using created_at or createdAt
      const itemTime = item.created_at ?? item.createdAt;
      if (!itemTime) {
        discardNoTimestamp++;
        return null;
      }

      const parsedTime = new Date(itemTime);
      if (!isNaN(parsedTime.getTime()) && parsedTime.getTime() < cutoffTimestamp) {
        discardOutsideWindow++;
        return null; // Will be filtered out
      }

      return {
        id: item.id ?? `${source.id}-${index + 1}`,
        sourceId: source.id,
        sourceType: source.type,
        contentType: source.contentType,
        sourceName: source.name,
        title,
        url: item.url
        ?? (typeof authorUsername === "string" && typeof item.id === "string"
          ? `https://x.com/${authorUsername}/status/${item.id}`
          : ""),
        author: authorUsername,
        publishedAt: parsedTime.toISOString(),
        fetchedAt: new Date().toISOString(),
        content: rawText,
        metadataJson: JSON.stringify({
          provider: "bird",
          sourceKind: source.type,
          tweetId: item.id,
          authorId: item.authorId,
          authorName,
          conversationId: item.conversationId,
          expandedUrl: item.expandedUrl ?? item.expanded_url,
          contentType: source.contentType,
          media: buildMediaMetadata(item.media),
          article: buildArticleMetadata(article),
          quote: buildQuoteMetadata(item.quote),
          thread: buildThreadMetadata(item.thread),
          parent: buildParentMetadata(item.parent),
        }),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null && item.url !== "") as RawItem[];

  // Log discard summary per source (D-04, D-05)
  const totalDiscarded = discardNoTimestamp + discardOutsideWindow;
  logger.info("Source fetch completed", {
    sourceId: source.id,
    sourceType: "bird",
    fetched: result.length,
    discardedNoTimestamp: discardNoTimestamp,
    discardedOutsideWindow: discardOutsideWindow,
    discardedInvalidTimestamp: 0,
    totalDiscarded,
  });

  return { items: result, discardNoTimestamp, discardOutsideWindow };
}

export async function collectXBirdSource(
  source: Source,
  options: { timeWindow: number; execImpl?: (command: string[]) => Promise<string> } = { timeWindow: 100 * 24 * 60 * 60 * 1000 },
): Promise<RawItem[]> {
  const { timeWindow, execImpl } = options;
  const jobStartedAt = new Date().toISOString();
  const effectiveExecImpl = execImpl ?? (async (command) => {
    const maskedCommand = maskSensitiveArgs(command);
    const startTime = Date.now();

    logger.info("Executing bird CLI", {
      command: maskedCommand.join(" "),
      sourceId: source.id,
    });

    logger.debug("Full command args", { args: maskedCommand });

    const proc = spawn(command[0], command.slice(1), {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const MAX_BUFFER_SIZE = 10 * 1024 * 1024;
    const [output, error, exitCode] = await new Promise<[string, string, number]>((resolve) => {
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let stdoutSize = 0;
      let stderrSize = 0;
      proc.stdout?.on("data", (chunk: Buffer) => {
        if (stdoutSize >= MAX_BUFFER_SIZE) {
          return;
        }
        if (stdoutSize + chunk.length > MAX_BUFFER_SIZE) {
          stdoutChunks.push(chunk.subarray(0, MAX_BUFFER_SIZE - stdoutSize));
          stdoutSize = MAX_BUFFER_SIZE;
          return;
        }
        stdoutChunks.push(chunk);
        stdoutSize += chunk.length;
      });
      proc.stderr?.on("data", (chunk: Buffer) => {
        if (stderrSize >= MAX_BUFFER_SIZE) {
          return;
        }
        if (stderrSize + chunk.length > MAX_BUFFER_SIZE) {
          stderrChunks.push(chunk.subarray(0, MAX_BUFFER_SIZE - stderrSize));
          stderrSize = MAX_BUFFER_SIZE;
          return;
        }
        stderrChunks.push(chunk);
        stderrSize += chunk.length;
      });
      proc.on("close", (code) => {
        resolve([
          Buffer.concat(stdoutChunks).toString(),
          Buffer.concat(stderrChunks).toString(),
          code ?? 1,
        ]);
      });
    });
    const elapsed = Date.now() - startTime;

    if (exitCode !== 0) {
      logger.error("bird CLI failed", {
        command: maskedCommand.join(" "),
        exitCode,
        stderr: truncateWithLength(error, 500),
        elapsed,
      });
      throw new Error(error || `bird CLI exited with status ${exitCode}`);
    }

    logger.info("bird CLI completed", {
      command: maskedCommand.join(" "),
      exitCode,
      outputSize: output.length,
      elapsed,
    });

    logger.debug("bird CLI output preview", {
      preview: truncateWithLength(output, 500),
    });

    return output;
  });
  const command = buildBirdCommand(source);
  const rawOutput = await effectiveExecImpl(command);
  saveDebugOutput(source.id, rawOutput);
  const { items } = parseBirdItems(rawOutput, source, jobStartedAt, timeWindow);
  return items;
}
