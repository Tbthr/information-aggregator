import type { SourceType } from "../types/index";
import type { QuerySpec } from "./spec";

const SOURCE_TYPES = new Set<SourceType>([
  "rss",
  "json-feed",
  "website",
  "hn",
  "reddit",
  "opml_rss",
  "digest_feed",
  "custom_api",
  "github_trending",
  "x_home",
  "x_list",
  "x_bookmarks",
  "x_likes",
  "x_multi",
]);

function pushValue(target: string[] | undefined, value: string): string[] {
  return [...(target ?? []), value];
}

export function parseQueryCliArgs(args: string[]): QuerySpec {
  const command = args[0] === "sources" && args[1] === "list" ? "sources list" : "run";
  const spec: QuerySpec = {
    command,
    format: "markdown",
  };

  for (let index = command === "sources list" ? 2 : 1; index < args.length; index += 1) {
    const token = args[index];
    const value = args[index + 1];

    switch (token) {
      case "--view":
        spec.viewId = value;
        index += 1;
        break;
      case "--format":
        spec.format = value === "json" ? "json" : "markdown";
        index += 1;
        break;
      case "--profile":
        spec.profileId = value;
        index += 1;
        break;
      case "--pack":
        spec.packIds = pushValue(spec.packIds, value);
        index += 1;
        break;
      case "--source":
        spec.sourceIds = pushValue(spec.sourceIds, value);
        index += 1;
        break;
      case "--source-type":
        if (!SOURCE_TYPES.has(value as SourceType)) {
          throw new Error(`Unsupported source type: ${value}`);
        }
        spec.sourceTypes = [...(spec.sourceTypes ?? []), value as SourceType];
        index += 1;
        break;
      case "--topic":
        spec.topicIds = pushValue(spec.topicIds, value);
        index += 1;
        break;
      case "--window":
        spec.window = value;
        index += 1;
        break;
      case "--since":
        spec.since = value;
        index += 1;
        break;
      case "--until":
        spec.until = value;
        index += 1;
        break;
      default:
        break;
    }
  }

  return spec;
}
