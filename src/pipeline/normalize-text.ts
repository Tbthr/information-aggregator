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

// Remove punctuation
function removePunctuation(value: string): string {
  // Keep basic punctuation for sentence structure (only remove truly disruptive chars)
  return value.replace(/[!"#$%&'*+,/:;<=>?@[\]^`{|}~]/g, "");
}

export function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeTitle(value: string): string {
  let result = value;
  result = removeRtPrefix(result);
  result = removeSiteName(result);
  result = removePunctuation(result);
  result = normalizeWhitespace(result).toLowerCase();
  return result;
}

export function normalizeSummary(value: string): string {
  let result = stripHtml(value);
  result = decodeHtmlEntities(result);
  result = normalizeWhitespace(result);
  result = result.toLowerCase();
  // Preserve sentence structure and punctuation
  return result;
}

export function normalizeContent(value: string, maxLength: number = 500): string {
  let result = stripHtml(value);
  result = decodeHtmlEntities(result);
  result = normalizeWhitespace(result);
  result = result.toLowerCase();

  if (result.length > maxLength) {
    // Truncate to maxLength and add ellipsis
    return result.slice(0, maxLength - 3) + "...";
  }
  return result;
}
