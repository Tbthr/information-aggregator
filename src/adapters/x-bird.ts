import type { RawItem, Source } from "../types/index";

interface BirdSourceConfig {
  birdMode?: string;
  listId?: string;
  authToken?: string;
  ct0?: string;
  authTokenEnv?: string;
  ct0Env?: string;
  chromeProfile?: string;
  chromeProfileDir?: string;
  cookieSource?: string[];
  cookieTimeoutMs?: number;
}

interface BirdItem {
  id?: string;
  text?: string;
  url?: string;
  expandedUrl?: string;
  expanded_url?: string;
  authorId?: string;
  author?: string | {
    username?: string;
    name?: string;
  };
  article?: {
    title?: string;
    previewText?: string;
  };
  createdAt?: string;
  created_at?: string;
  likeCount?: number;
  replyCount?: number;
  retweetCount?: number;
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

export function buildBirdCommand(source: Pick<Source, "type" | "configJson">): string[] {
  const config = getBirdConfig(source);
  const mode = getBirdMode(source);
  const authArgs = getBirdAuthArgs(config);

  if (mode === "home" || mode === "bookmarks" || mode === "likes") {
    return ["bird", ...authArgs, mode, "--json"];
  }

  if (mode === "list") {
    if (!config.listId) {
      throw new Error("x list source requires listId");
    }

    return ["bird", ...authArgs, "list-timeline", config.listId, "--json"];
  }

  throw new Error(`Unsupported birdMode: ${mode}`);
}

function parseBirdItems(payload: string, source: Source): RawItem[] {
  const items = JSON.parse(payload) as BirdItem[];
  if (!Array.isArray(items)) {
    throw new Error("bird CLI output must be a JSON array");
  }

  return items
    .filter((item) => typeof item.text === "string")
    .map((item, index) => {
      const rawText = item.text ?? `Post ${index + 1}`;
      const title = typeof item.article?.title === "string" && item.article.title.trim() !== ""
        ? item.article.title.trim()
        : normalizeBirdTitle(rawText);
      return {
        id: item.id ?? `${source.id}-${index + 1}`,
        sourceId: source.id,
        title,
        url: item.url
        ?? (typeof item.author === "object" && typeof item.author?.username === "string" && typeof item.id === "string"
          ? `https://x.com/${item.author.username}/status/${item.id}`
          : ""),
        author: typeof item.author === "string" ? item.author : item.author?.username,
        snippet: rawText,
        publishedAt: item.created_at ?? item.createdAt,
        fetchedAt: new Date().toISOString(),
        metadataJson: JSON.stringify({
          provider: "bird",
          sourceType: source.type,
          contentType: "social_post",
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
