import { ZodError, type ZodIssue } from "zod";

export type ApiErrorBody = {
  error: string;
  code: string;
  fields?: Record<string, string>;
};

export class ApiError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string>;
  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export function zodFields(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues as ZodIssue[]) {
    const key = String(issue.path[0] ?? "form");
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

export function parseOrThrow<T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: ZodError } }, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ApiError(422, "VALIDATION_ERROR", "Please correct the highlighted fields.", zodFields(result.error!));
  }
  return result.data as T;
}

/** Map internal failures to safe, human-readable messages. Never leaks stack traces,
 *  connection strings, or ORM internals to the client. */
export function safeError(err: unknown): { status: number; body: ApiErrorBody } {
  if (err instanceof ApiError) {
    return {
      status: err.status,
      body: { error: err.message, code: err.code, ...(err.fields ? { fields: err.fields } : {}) },
    };
  }
  if (err instanceof ZodError) {
    return {
      status: 422,
      body: {
        error: "Please correct the highlighted fields.",
        code: "VALIDATION_ERROR",
        fields: zodFields(err),
      },
    };
  }
  const message = err instanceof Error ? err.message : "";
  if (/connect|econnrefused|timeout|pool|database/i.test(message)) {
    return {
      status: 503,
      body: {
        error: "The data service is unavailable right now. Please try again shortly.",
        code: "DB_UNAVAILABLE",
      },
    };
  }
  return {
    status: 500,
    body: { error: "Something went wrong while processing that request.", code: "INTERNAL_ERROR" },
  };
}
