import type { OutputFormat, SourceType } from "../types/index";

export interface QuerySpec {
  command: "run" | "sources list";
  viewId?: string;
  format: OutputFormat;
  profileId?: string;
  packIds?: string[];
  sourceIds?: string[];
  sourceTypes?: SourceType[];
  topicIds?: string[];
  window?: string;
  since?: string;
  until?: string;
}
