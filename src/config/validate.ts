import type { Source } from "../types/index";

function assertString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Invalid source field: ${field}`);
  }

  return value;
}

export function validateSource(input: unknown): Source {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid source entry");
  }

  const record = input as Record<string, unknown>;

  if (typeof record.enabled !== "boolean") {
    throw new Error("Invalid source field: enabled");
  }

  return {
    id: assertString(record.id, "id"),
    name: assertString(record.name, "name"),
    type: assertString(record.type, "type"),
    enabled: record.enabled,
    url: typeof record.url === "string" ? record.url : undefined,
    configJson: JSON.stringify(record.config ?? {}),
  };
}
