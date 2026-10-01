export class ApiClientError extends Error {
  status: number;
  code: string;
  fields: Record<string, string>;
  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields ?? {};
  }
}

type Options = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  cache?: RequestCache;
};

/** Thin fetch wrapper: same-origin, credentials included, typed errors. */
export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const { method = "GET", body, cache } = options;
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      cache,
      credentials: "same-origin",
      headers: body !== undefined ? { "content-type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...(method !== "GET" ? { headers: { "content-type": "application/json", ...(await originHeader()) } } : {}),
    });
  } catch {
    throw new ApiClientError(
      0,
      "NETWORK",
      "Network failure — we could not reach the server. Check your connection and try again.",
    );
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!res.ok) {
    const p = payload as { error?: string; code?: string; fields?: Record<string, string> } | null;
    throw new ApiClientError(
      res.status,
      p?.code ?? "ERROR",
      p?.error ?? (res.status === 401 ? "Your session has expired. Please sign in again." : "The request could not be completed."),
      p?.fields,
    );
  }
  return payload as T;
}

async function originHeader(): Promise<Record<string, string>> {
  return { "content-type": "application/json" };
}

/** Serialises a form payload from a FormData object, dropping empty strings to null. */
export function fromForm(form: FormData, keys: string[]) {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const value = form.get(key);
    out[key] = typeof value === "string" ? (value.trim() === "" ? null : value.trim()) : value;
  }
  return out;
}
