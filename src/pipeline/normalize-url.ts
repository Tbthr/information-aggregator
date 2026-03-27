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

  // Strip www. prefix
  if (url.hostname.startsWith("www.")) {
    url.hostname = url.hostname.slice(4);
  }

  // Normalize twitter to x.com
  if (url.hostname === "twitter.com" || url.hostname === "www.twitter.com" || url.hostname === "www.x.com") {
    url.hostname = "x.com";
  }

  // Strip fragment
  url.hash = "";

  // Remove tracking params
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) {
      url.searchParams.delete(key);
    }
  }

  // Normalize trailing slash
  const pathname = url.pathname !== "/" && url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname;
  url.pathname = pathname || "/";

  const search = url.searchParams.toString();
  return `${url.origin}${url.pathname}${search ? `?${search}` : ""}`;
}

// Canonical URL resolution is removed per spec - only use normalizeUrl
export { normalizeUrl as resolveCanonicalUrl };
