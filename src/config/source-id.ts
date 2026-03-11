export function generateSourceId(url: string): string {
  const parsed = new URL(url);
  const hostPart = parsed.hostname.replace(/\./g, "-");
  const pathPart = parsed.pathname
    .replace(/^\//, "")
    .replace(/\/$/, "")
    .replace(/[^a-z0-9]/gi, "-")
    .replace(/-+/g, "-");

  if (!pathPart) {
    return hostPart;
  }
  return `${hostPart}-${pathPart}`;
}
