import type { RawItem, Source } from "../types/index";
import { parseJsonFeedItems } from "./json-feed";

export async function collectJsonFeedSource(
  source: Source,
  fetchImpl: typeof fetch = fetch,
): Promise<RawItem[]> {
  const response = await fetchImpl(source.url ?? "");
  const payload = await response.json();
  return parseJsonFeedItems(payload, source.id);
}
