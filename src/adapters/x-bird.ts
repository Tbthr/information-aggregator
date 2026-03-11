import type { RawItem, Source } from "../types/index";

interface BirdSourceConfig {
  birdMode?: string;
  listId?: string;
  count?: number;
  fetchAll?: boolean;
  maxPages?: number;
  authToken?: string;
  ct0?: string;
  authTokenEnv?: string;
  ct0Env?: string;
  chromeProfile?: string;
  chromeProfileDir?: string;
  cookieSource?: string[];
  cookieTimeoutMs?: number;
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
  const collapsed = withoutUrls.replace(/\s+/g, " ");
  return collapsed.length > 120 ? `${collapsed.slice(0, 117).trimEnd()}...` : collapsed;
}

function getBirdConfig(source: Pick<Source, "configJson">): BirdSourceConfig {
  return JSON.parse(source.configJson ?? "{}") as BirdSourceConfig;
}

function getTokenFromEnv(name: string | undefined): string | undefined {
  if (!name) {
    return undefined;
  }

  const value = process.env[name];
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function getBirdAuthArgs(config: BirdSourceConfig): string[] {
  const authToken = config.authToken ?? getTokenFromEnv(config.authTokenEnv);
  const ct0 = config.ct0 ?? getTokenFromEnv(config.ct0Env);
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
    for (const source of config.cookieSource ?? []) {
      args.push("--cookie-source", source);
    }
    if (typeof config.cookieTimeoutMs === "number") {
      args.push("--cookie-timeout", String(config.cookieTimeoutMs));
    }
  }

  return args;
}

function getBirdMode(source: Pick<Source, "configJson">): string {
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

export function buildBirdCommand(source: Pick<Source, "type" | "configJson">): string[] {
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

function buildMediaMetadata(media: BirdMedia[] | undefined): { type: string; url: string; previewUrl?: string }[] | undefined {
  if (!media || media.length === 0) {
    return undefined;
  }
  return media
    .filter((m) => m.type && m.url)
    .map((m) => ({
      type: m.type as string,
      url: m.url as string,
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

function parseBirdItems(payload: string, source: Source): RawItem[] {
  const parsed = JSON.parse(payload) as BirdItem[] | { tweets: BirdItem[] };
  // --all 参数会返回 {"tweets": [...]} 结构，需要提取 tweets 数组
  const items = Array.isArray(parsed) ? parsed : (parsed as { tweets: BirdItem[] }).tweets;
  if (!Array.isArray(items)) {
    throw new Error("bird CLI output must be a JSON array or {tweets: [...]}");
  }

  return items
    .filter((item) => typeof item.text === "string")
    .map((item, index) => {
      const rawText = item.text ?? `Post ${index + 1}`;
      const article = item.article;
      const title = typeof article?.title === "string" && article.title.trim() !== ""
        ? article.title.trim()
        : normalizeBirdTitle(rawText);
      const authorUsername = extractAuthorUsername(item.author);

      return {
        id: item.id ?? `${source.id}-${index + 1}`,
        sourceId: source.id,
        title,
        url: item.url
        ?? (typeof authorUsername === "string" && typeof item.id === "string"
          ? `https://x.com/${authorUsername}/status/${item.id}`
          : ""),
        author: authorUsername,
        snippet: rawText,
        publishedAt: item.created_at ?? item.createdAt,
        fetchedAt: new Date().toISOString(),
        metadataJson: JSON.stringify({
          provider: "bird",
          sourceType: source.type,
          contentType: "social_post",
          conversationId: item.conversationId,
          engagement: item.likeCount === undefined && item.replyCount === undefined && item.retweetCount === undefined
            ? undefined
            : {
              score: item.likeCount,
              comments: item.replyCount,
              reactions: item.retweetCount,
            },
          canonicalHints: item.expanded_url || item.expandedUrl
            ? { expandedUrl: item.expanded_url ?? item.expandedUrl }
            : undefined,
          article: buildArticleMetadata(article),
          media: buildMediaMetadata(item.media),
          quote: buildQuoteMetadata(item.quote),
          thread: buildThreadMetadata(item.thread),
          parent: buildParentMetadata(item.parent),
        }),
      };
    })
    .filter((item) => item.url !== "");
}

export async function collectXBirdSource(
  source: Source,
  execImpl: (command: string[]) => Promise<string> = async (command) => {
    const proc = Bun.spawn(command, {
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    const error = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      throw new Error(error || `bird CLI exited with status ${exitCode}`);
    }
    return output;
  },
): Promise<RawItem[]> {
  const command = buildBirdCommand(source);
  return parseBirdItems(await execImpl(command), source);
}
