import { createHash } from "node:crypto";

/* ------------------------------------------------------------------ *
 * Fixed-window in-memory rate limiter for authentication-sensitive
 * endpoints (login, register, forgot-password, reset-password).
 * Keyed by IP + identifier. Slides forward on each attempt.
 *
 * PRODUCTION LIMITATION (accepted, documented — not a fix):
 * This store is a `Map` held on `globalThis` inside a single Node process.
 * On Vercel each serverless function instance gets its own isolated memory,
 * so the effective limit is roughly `limit x (number of live instances)`.
 * It is therefore a *best-effort* throttle, not a globally enforced limit, and
 * a coordinated attacker can exceed the documented figures by fanning out
 * across instances. Fixing this properly requires shared state (Redis, or a
 * Drizzle-backed counter table with an atomic UPSERT); neither exists in this
 * project today, so no new infrastructure was introduced in Phase 6.
 *
 * Fail behaviour: fail-CLOSED. `rateLimit()` itself cannot fail — it is pure
 * in-memory arithmetic with no I/O and no network dependency — so there is no
 * fail-open path. Callers treat `ok: false` as a hard 429.
 *
 * Concurrency: a single Node process executes JS synchronously, so the
 * read-modify-write in `rateLimit()` cannot interleave with another request on
 * the same instance. It is safe against concurrent requests *within* an
 * instance; it is not shared across instances (see above).
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
