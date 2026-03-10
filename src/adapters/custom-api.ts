import type { RawItem, Source } from "../types/index";

interface CustomApiConfig {
  itemPath?: string;
  fieldMap?: Record<string, string>;
}

function getCustomApiConfig(source: Source): CustomApiConfig {
  return JSON.parse(source.configJson ?? "{}") as CustomApiConfig;
}

function getValueAtPath(payload: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, payload);
}

function assertFieldMap(config: CustomApiConfig): Record<string, string> {
  if (!config.fieldMap || typeof config.fieldMap !== "object") {
    throw new Error("custom_api fieldMap must include title and url");
  }

  if (typeof config.fieldMap.title !== "string" || typeof config.fieldMap.url !== "string") {
    throw new Error("custom_api fieldMap must include title and url");
  }

  return config.fieldMap;
}

export async function collectCustomApiSource(source: Source, fetchImpl: typeof fetch = fetch): Promise<RawItem[]> {
  const config = getCustomApiConfig(source);
  const itemPath = typeof config.itemPath === "string" ? config.itemPath : null;
  if (!itemPath) {
    throw new Error("custom_api source requires config.itemPath");
  }

  const fieldMap = assertFieldMap(config);
  const response = await fetchImpl(source.url ?? "");
  const payload = await response.json();
  const items = getValueAtPath(payload, itemPath);
  if (!Array.isArray(items)) {
    throw new Error("custom_api itemPath must resolve to an array");
  }

  return items.map((item, index) => {
    const record = item as Record<string, unknown>;
    const title = record[fieldMap.title];
    const url = record[fieldMap.url];
    if (typeof title !== "string" || typeof url !== "string") {
      throw new Error("custom_api mapped title/url must be strings");
    }

    const snippetPath = fieldMap.snippet;
    const publishedAtPath = fieldMap.publishedAt;

    return {
      id: `${source.id}-${index + 1}`,
      sourceId: source.id,
      title,
      url,
      snippet: typeof snippetPath === "string" && typeof record[snippetPath] === "string" ? String(record[snippetPath]) : undefined,
      publishedAt: typeof publishedAtPath === "string" && typeof record[publishedAtPath] === "string" ? String(record[publishedAtPath]) : undefined,
      fetchedAt: new Date().toISOString(),
      metadataJson: JSON.stringify({
        provider: "custom_api",
        sourceType: "custom_api",
        contentType: "article",
      }),
    };
  });
}
