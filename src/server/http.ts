import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError, safeError, type ApiErrorBody } from "@/lib/api-error";

export function json<T>(body: T, status = 201) {
  return NextResponse.json(body, { status });
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export function fail(status: number, body: ApiErrorBody) {
  return NextResponse.json(body, { status });
}

/** Wraps a route handler with consistent error mapping. */
export async function handle<T>(fn: () => Promise<T>, successStatus = 200): Promise<Response> {
  try {
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
