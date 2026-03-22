import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import type { z } from "zod"

// ── Response helpers ──

export function success<T>(data?: T, meta?: Record<string, unknown>) {
  const body: Record<string, unknown> = { success: true }
  if (data !== undefined) body.data = data
  if (meta) body.meta = meta
  return NextResponse.json(body)
}

export function error(message: string, status = 500, details?: unknown) {
  const body: Record<string, unknown> = { success: false, error: message }
  if (details !== undefined) body.details = details
  return NextResponse.json(body, { status })
}

// ── Request parsing ──

export async function parseBody(request: Request): Promise<unknown> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    throw new ParseError("Invalid JSON in request body", 400)
  }
  return body
}

export class ParseError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

// ── Validation ──

export type ValidationSuccess<T> = { success: true; data: T }
export type ValidationFailure = { success: false; response: NextResponse }
export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure

export function validateBody<T>(body: unknown, schema: z.ZodType<T>): ValidationResult<T> {
  const result = schema.safeParse(body)
  if (!result.success) {
    return { success: false, response: error("Invalid request data", 400, result.error.flatten()) }
  }
  return { success: true, data: result.data }
}

// ── Timing ──

export function startTimer() {
  return Date.now()
}

export function timing(startTime: number) {
  return {
    generatedAt: new Date().toISOString(),
    latencyMs: Date.now() - startTime,
  }
}

// ── Prisma error handling ──

const prismaErrorMessages: Partial<Record<string, string>> = {
  P2002: "Record already exists",
  P2003: "Referenced record not found",
  P2025: "Record not found",
}

export type PrismaErrorContext = {
  p2002?: string
  p2003?: string
  p2025?: string
}

const statusByCode: Record<string, number> = {
  P2002: 409,
  P2003: 400,
  P2025: 404,
}

const codeToContextKey: Record<string, keyof PrismaErrorContext> = {
  P2002: "p2002",
  P2003: "p2003",
  P2025: "p2025",
}

export function handlePrismaError(
  err: unknown,
  context?: PrismaErrorContext,
): NextResponse | null {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code in prismaErrorMessages
  ) {
    const code = err.code as keyof typeof prismaErrorMessages
    const contextKey = codeToContextKey[code]
    const message = (context && contextKey && context[contextKey]) || prismaErrorMessages[code]!
    const status = statusByCode[code] ?? 500
    return error(message, status)
  }
  return null
}
