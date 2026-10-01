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
    if (err instanceof ZodError) {
      const { status, body } = safeError(err);
      return fail(status, body);
    }
    if (err instanceof ApiError) {
      return fail(err.status, { error: err.message, code: err.code, ...(err.fields ? { fields: err.fields } : {}) });
    }
    const { status, body } = safeError(err);
    return fail(status, body);
  }
}
