import type { RawItem, Source } from "../types/index";

interface BirdSourceConfig {
  birdMode?: string;
  listId?: string;
  listIds?: string[];
}

interface BirdItem {
  id?: string;
  text?: string;
  url?: string;
  expanded_url?: string;
  author?: string;
  created_at?: string;
}

function getBirdConfig(source: Pick<Source, "configJson">): BirdSourceConfig {
  return JSON.parse(source.configJson ?? "{}") as BirdSourceConfig;
}

export function buildBirdCommand(source: Pick<Source, "type" | "configJson">): string[] {
  const config = getBirdConfig(source);
  const mode = config.birdMode;
  if (!mode) {
    throw new Error("x source requires birdMode");
  }

  const command = ["bird", mode];
  if (mode === "list" && config.listId) {
    command.push("--list-id", config.listId);
  }

  if (mode === "multi") {
    for (const listId of config.listIds ?? []) {
      command.push("--list", listId);
    }
  }

  return command;
}

function parseBirdItems(payload: string, source: Source): RawItem[] {
  const items = JSON.parse(payload) as BirdItem[];
  if (!Array.isArray(items)) {
    throw new Error("bird CLI output must be a JSON array");
  }

  return items
    .filter((item) => typeof item.text === "string" && typeof item.url === "string")
    .map((item, index) => ({
      id: item.id ?? `${source.id}-${index + 1}`,
      sourceId: source.id,
      title: item.text ?? `Post ${index + 1}`,
      url: item.url ?? "",
      author: item.author,
      publishedAt: item.created_at,
      fetchedAt: new Date().toISOString(),
      metadataJson: JSON.stringify({
        provider: "bird",
        sourceType: source.type,
        contentType: "social_post",
        canonicalHints: item.expanded_url ? { expandedUrl: item.expanded_url } : undefined,
      }),
    }));
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
  const output = await execImpl(buildBirdCommand(source));
  return parseBirdItems(output, source);
}
