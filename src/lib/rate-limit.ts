import { createHash } from "node:crypto";

/* ------------------------------------------------------------------ *
 * Fixed-window in-memory rate limiter for authentication-sensitive
 * endpoints (login, register, forgot-password, reset-password).
 * Keyed by IP + identifier. Slides forward on each attempt.
 * ------------------------------------------------------------------ */

type Bucket = { count: number; resetAt: number };

const globalStore = globalThis as typeof globalThis & { __cdRateLimit?: Map<string, Bucket> };
const store = (globalStore.__cdRateLimit ??= new Map<string, Bucket>());

export type RateLimitResult = { ok: boolean; retryAfterSeconds: number; remaining: number };

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    if (store.size > 5000) {
      for (const [k, v] of store) if (v.resetAt <= now) store.delete(k);
    }
    return { ok: true, retryAfterSeconds: Math.ceil(windowMs / 1000), remaining: limit - 1 };
  }

  bucket.count += 1;
  const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  return {
    ok: bucket.count <= limit,
    retryAfterSeconds,
    remaining: Math.max(0, limit - bucket.count),
  };
}

export function clientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}
