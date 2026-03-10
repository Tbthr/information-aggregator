import type { RawItemMetadata } from "../types/index";

const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "ref",
  "utm_campaign",
  "utm_content",
  "utm_medium",
  "utm_source",
  "utm_term",
]);

export function normalizeUrl(input: string): string {
  const url = new URL(input);
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();
  if (url.hostname === "twitter.com" || url.hostname === "www.twitter.com" || url.hostname === "www.x.com") {
    url.hostname = "x.com";
  }
  url.hash = "";

  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) {
      url.searchParams.delete(key);
    }
  }

  const pathname = url.pathname !== "/" && url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname;
  url.pathname = pathname || "/";

  const search = url.searchParams.toString();
  return `${url.origin}${url.pathname}${search ? `?${search}` : ""}`;
}

export function resolveCanonicalUrl(input: string, metadata?: RawItemMetadata | null): string {
  const hintedUrl = metadata?.canonicalHints?.linkedUrl
    ?? metadata?.canonicalHints?.externalUrl
    ?? metadata?.canonicalHints?.expandedUrl
    ?? input;

  return normalizeUrl(hintedUrl);
}
