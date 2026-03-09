function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeTitle(value: string): string {
  return normalizeWhitespace(value).toLowerCase();
}

export function normalizeSnippet(value?: string): string {
  if (!value) {
    return "";
  }
  return normalizeWhitespace(value).toLowerCase();
}
