import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError, safeError, type ApiErrorBody } from "@/lib/api-error";
import { assertSameOrigin } from "@/server/auth";

const MUTATING = new Set(["POST", "PATCH", "PUT", "DELETE"]);

export function json<T>(body: T, status = 201) {
  return NextResponse.json(body, { status });
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export function fail(status: number, body: ApiErrorBody) {
  return NextResponse.json(body, { status });
}

/** Wraps a route handler with consistent error mapping. State-changing requests
 *  run the same-origin CSRF gate centrally, so every mutation route is covered
 *  even though assertSameOrigin() was previously only wired into auth routes. */
export async function handle<T>(fn: () => Promise<T>, successStatus = 200, req?: Request): Promise<Response> {
  try {
    if (req && MUTATING.has(req.method)) await assertSameOrigin();
    const data = await fn();
    return NextResponse.json(data, { status: successStatus });
  } catch (err) {
    // A body that is not parseable JSON is a client error, not a server fault.
    // Without this branch a truncated/garbage payload surfaced as a 500.
    if (err instanceof SyntaxError) {
      return fail(400, {
        error: "The request body could not be read as JSON.",
        code: "INVALID_JSON",
      });
    }
    if (err instanceof ZodError) {
      const { status, body } = safeError(err);
      return fail(status, body);
    }
    if (err instanceof ApiError) {
      return fail(err.status, { error: err.message, code: err.code, ...(err.fields ? { fields: err.fields } : {}) });
    }
    // Unexpected failures are logged server-side only (never to the client) so
    // they are still diagnosable on Vercel without leaking internals in the
    // response body.
    if (!(err instanceof ApiError) && !(err instanceof ZodError) && !(err instanceof SyntaxError)) {
      console.error("[api] unhandled route error", err);
    }
    const { status, body } = safeError(err);
    return fail(status, body);
  }
}
