"use client";

import { ApiClientError, api } from "@/lib/client";

/** Server-authorised delete with a confirm step handled by the caller. */
export async function remove(path: string) {
  await api(path, { method: "DELETE" });
}

export async function patch<T>(path: string, body: unknown): Promise<T> {
  return api<T>(path, { method: "PATCH", body });
}

export function describe(err: unknown): { title: string; detail?: string } {
  if (err instanceof ApiClientError) {
    const first = Object.values(err.fields ?? {})[0];
    return { title: err.message, detail: first && first !== err.message ? first : undefined };
  }
  return { title: "The request could not be completed.", detail: "Please try again." };
}
