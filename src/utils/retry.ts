import { Prisma } from "@prisma/client";

/**
 * Sleep utility for exponential backoff
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Classify whether a Prisma error is transient (retriable).
 * Transient: P2034 (deadlock), P2024 (timeout), P1000/P1001/P1002 (connection)
 * Non-transient: P2006/P2013 (validation), P2002 (unique constraint), P2025 (not found), P2003 (foreign key)
 */
export function isTransientPrismaError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return ["P2034", "P2024", "P1000", "P1001", "P1002"].includes(err.code);
  }
  return false;
}

export interface RetryOptions {
  maxAttempts?: number;  // default 3
  baseDelayMs?: number;  // default 100
}

/**
 * Wraps a Prisma operation with exponential backoff retry.
 * Only retries transient Prisma errors (deadlock, timeout, connection).
 * Non-transient errors surface immediately.
 *
 * Backoff schedule: attempt 1 fails -> wait 100ms, attempt 2 fails -> wait 200ms, attempt 3 fails -> throw.
 *
 * On final failure, annotates the thrown error with retryCount = attempt - 1 so callers
 * can include the actual retry count in structured logs.
 */
export async function withPrismaRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 100 } = options;
  let lastError: unknown;
  let retryCount = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts) break;
      if (!isTransientPrismaError(err)) throw err;
      retryCount = attempt;
      await sleep(baseDelayMs * Math.pow(2, attempt - 1));
    }
  }
  // Annotate the error with retry count before throwing so callers can log it
  (lastError as { retryCount?: number }).retryCount = retryCount;
  throw lastError;
}

/**
 * Classify error type for structured logging.
 * Returns: "PrismaError" | "NetworkError" | "ValidationError" | "Unknown"
 */
export function classifyError(err: unknown): "PrismaError" | "NetworkError" | "ValidationError" | "Unknown" {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Transient Prisma errors
    if (["P2034", "P2024", "P1000", "P1001", "P1002"].includes(err.code)) {
      return "PrismaError";
    }
    // Validation errors (non-transient)
    if (["P2006", "P2013", "P2000", "P2001", "P2005"].includes(err.code)) {
      return "ValidationError";
    }
    return "PrismaError";
  }
  // Network errors (ECONNREFUSED, ENOTFOUND, etc.)
  if (err instanceof Error) {
    if (err.message.includes("ECONNREFUSED") || err.message.includes("ENOTFOUND") || err.message.includes("ETIMEDOUT")) {
      return "NetworkError";
    }
  }
  return "Unknown";
}
