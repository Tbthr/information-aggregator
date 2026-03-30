// Remove HTML tags
function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "");
}

// Decode common HTML entities
function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

// Remove trailing site name pattern like " | SiteName" or " - SiteName"
// Handles multiple pipe patterns iteratively: "Title | Site | Another" → "Title"
function removeSiteName(value: string): string {
  let result = value;
  // Keep removing trailing site name patterns until none remain
  while (/\s*[|\-–—]\s*[^|\-–—]+$/.test(result)) {
    result = result.replace(/\s*[|\-–—]\s*[^|\-–—]+$/, "");
  }
  return result;
}

// Remove RT @xxx: prefix
function removeRtPrefix(value: string): string {
  return value.replace(/^RT\s*@\w+:\s*/i, "");
}

// Remove bare URLs from text
function removeBareUrls(value: string): string {
  // Remove t.co and other shortened URLs
  return value.replace(/https?:\/\/\S+/g, "").trim();
}

// Remove punctuation for dedup comparison
function removePunctuation(value: string): string {
  // Keep basic punctuation for sentence structure (only remove truly disruptive chars)
  return value.replace(/[!"#$%&'*+,/:;<=>?@[\]^`{|}~]/g, "");
}

export function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * Normalize title according to content type:
 * - article: HTML decode → 去 RT 前缀 → 去尾部站点名 → 空白折叠 → 截断(160)
 * - tweet: 去裸 URL → 空白折叠 → 截断(160)
 * - other: decode → remove RT → remove site name → collapse whitespace → truncate(160)
 *
 * Returns null if title is empty after normalization (caller should discard)
 */
export function normalizeTitle(value: string, contentType?: string): string | null {
  let result = value;

  if (contentType === "tweet") {
    // Tweet: remove bare URLs, collapse whitespace, truncate
    result = removeBareUrls(result);
  } else {
    // Article and others: full normalization
    result = removeRtPrefix(result);
    result = removeSiteName(result);
  }

  result = decodeHtmlEntities(result);
  result = normalizeWhitespace(result);

  // Truncate to 160 characters
  if (result.length > 160) {
    result = result.slice(0, 157) + "...";
  }

  return result || null;
}

/**
 * Normalize summary for storage and display.
 * - article: use summary field directly, strip HTML, decode entities
 * - tweet: use tweet text + quote text + article preview text + thread summary
 */
export function normalizeSummary(value: string): string {
  let result = stripHtml(value);
  result = decodeHtmlEntities(result);
  result = normalizeWhitespace(result);
  result = result.toLowerCase();
  // Preserve sentence structure and punctuation
  return result;
}

/**
 * Normalize content body according to content type:
 * - article: 正文摘要/内容 > feed summary > title fallback
 * - tweet: tweet text + quote text + article preview text + thread 摘要
 * - Pure text: 去 HTML → decode → collapse → truncate(500)
 *
 * Empty body退化到title，仍空则返回null (caller should discard)
 */
export function normalizeContent(
  value: string,
  contentType: string = "article",
  fallbackTitle?: string | null,
  maxLength: number = 500
): string | null {
  if (!value || value.trim() === "") {
    // Fall back to title if available
    if (fallbackTitle) {
      value = fallbackTitle;
    } else {
      return null;
    }
  }

  let result = stripHtml(value);
  result = decodeHtmlEntities(result);
  result = normalizeWhitespace(result);

  // Truncate to maxLength
  if (result.length > maxLength) {
    result = result.slice(0, maxLength - 3) + "...";
  }

  return result || null;
}

/**
 * Derive dedupe text: title + " " + body → lowercase → 去标点 → 空白折叠
 * Not stored in DB, only used for near-dedup comparison
 */
export function deriveDedupeText(title: string, body: string): string {
  const combined = `${title} ${body}`.toLowerCase();
  const depunctuated = removePunctuation(combined);
  return normalizeWhitespace(depunctuated);
}
