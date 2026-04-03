// Tracking parameters to remove from URLs
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
  "utm_id",
  "utm_cid",
]);

// Pattern for any utm_* parameter (broader match)
const UTM_PARAM_PATTERN = /^utm_/i;

/**
 * Normalize URL according to the 7-step contract:
 * 1. Protocol lowercase
 * 2. Hostname lowercase, strip www., normalize twitter.com/www.twitter.com/www.x.com → x.com
 * 3. Strip fragment
 * 4. Remove tracking params (fbclid, gclid, mc_cid, mc_eid, ref, utm_*)
 * 5. Remove trailing non-root slash
 * 6. X/Twitter URLs should be expanded (caller must provide expanded URL from metadata)
 * 7. Return normalized URL string
 */
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
    const lowerKey = key.toLowerCase();
    if (TRACKING_PARAMS.has(lowerKey) || UTM_PARAM_PATTERN.test(key)) {
      url.searchParams.delete(key);
    }
  }

  // Normalize trailing slash (only for non-root paths)
  const pathname = url.pathname !== "/" && url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname;
  url.pathname = pathname || "/";

  const search = url.searchParams.toString();
  return `${url.origin}${url.pathname}${search ? `?${search}` : ""}`;
}

/**
 * Normalize URL with expanded URL for X/Twitter content.
 * Uses expandedUrl from metadata when available for X/Twitter URLs.
 */
export function normalizeUrlWithExpansion(input: string, expandedUrl?: string | null): string {
  // If we have an expanded URL for X/Twitter, normalize that instead
  if (expandedUrl && (input.includes("twitter.com") || input.includes("x.com") || input.includes("t.co"))) {
    return normalizeUrl(expandedUrl);
  }
  return normalizeUrl(input);
}

// Canonical URL resolution is removed per spec - only use normalizeUrl
export { normalizeUrl as resolveCanonicalUrl };
