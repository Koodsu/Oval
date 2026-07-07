import { NextFunction, Request, Response } from 'express';

/**
 * Global request-input sanity guard.
 *
 * Route handlers do their own field-level validation (types, trimming, length
 * caps); this middleware is the backstop that stops structurally-hostile input
 * from ever reaching them or Prisma:
 *
 * - deeply nested JSON (stack pressure / pathological Prisma filters)
 * - huge arrays or key counts (memory / query blowup within the 64kb body cap)
 * - absurdly long strings a route forgot to cap
 * - prototype-pollution key names (`__proto__`, `constructor`, `prototype`)
 * - nested-object query params (?limit[$gt]=1 style type confusion)
 *
 * Violations get a generic 400 — these are never legitimate client requests.
 */

const MAX_DEPTH = 8;
const MAX_TOTAL_KEYS = 500;
const MAX_ARRAY_LENGTH = 300;
const MAX_STRING_LENGTH = 20_000;
const MAX_QUERY_VALUE_LENGTH = 2_000;

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

interface ScanState {
  keyCount: number;
}

function scan(value: unknown, depth: number, state: ScanState): boolean {
  if (depth > MAX_DEPTH) return false;

  if (typeof value === 'string') {
    return value.length <= MAX_STRING_LENGTH;
  }
  if (value === null || typeof value !== 'object') {
    return true;
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY_LENGTH) return false;
    for (const item of value) {
      if (!scan(item, depth + 1, state)) return false;
    }
    return true;
  }
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_KEYS.has(key)) return false;
    state.keyCount += 1;
    if (state.keyCount > MAX_TOTAL_KEYS) return false;
    if (!scan((value as Record<string, unknown>)[key], depth + 1, state)) return false;
  }
  return true;
}

/** True when every query value is a flat string (or array of strings) of sane length. */
function queryIsSane(query: unknown): boolean {
  if (query === null || typeof query !== 'object') return true;
  for (const [key, value] of Object.entries(query as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.has(key)) return false;
    if (typeof value === 'string') {
      if (value.length > MAX_QUERY_VALUE_LENGTH) return false;
    } else if (Array.isArray(value)) {
      if (value.length > 50) return false;
      for (const item of value) {
        if (typeof item !== 'string' || item.length > MAX_QUERY_VALUE_LENGTH) return false;
      }
    } else {
      // Nested object — express "extended" query parsing of e.g. ?a[b]=c.
      // No route expects this shape; reject to prevent type confusion.
      return false;
    }
  }
  return true;
}

export function inputGuard(req: Request, res: Response, next: NextFunction): void {
  if (!queryIsSane(req.query)) {
    res.status(400).json({ error: 'Invalid query parameters' });
    return;
  }
  if (req.body !== undefined && req.body !== null) {
    const state: ScanState = { keyCount: 0 };
    if (!scan(req.body, 0, state)) {
      res.status(400).json({ error: 'Invalid request body' });
      return;
    }
  }
  next();
}

// Exported for tests
export const INPUT_GUARD_LIMITS = {
  MAX_DEPTH,
  MAX_TOTAL_KEYS,
  MAX_ARRAY_LENGTH,
  MAX_STRING_LENGTH,
  MAX_QUERY_VALUE_LENGTH,
} as const;
