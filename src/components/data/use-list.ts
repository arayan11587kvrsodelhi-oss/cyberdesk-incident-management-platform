"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiClientError, api } from "@/lib/client";

export type ListState = Record<string, string>;

export type ListResult<T> = {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
};

/**
 * Filter/pagination state + fetch lifecycle for a list endpoint.
 * Handles abort on rapid filter changes, loading, and typed errors.
 */
export function useList<T>(path: string, defaults: ListState = {}) {
  const [params, setParams] = useState<ListState>(() => ({ page: "1", ...defaults }));
  const [data, setData] = useState<ListResult<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiClientError | null>(null);
  const seq = useRef(0);

  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== "" && v !== "ALL") query.set(k, v);
  }
  const target = `${path}?${query.toString()}`;

  const reload = useCallback(() => {
    setParams((p) => ({ ...p }));
  }, []);

  useEffect(() => {
    const id = ++seq.current;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    api<ListResult<T>>(target, { cache: "no-store" })
      .then((res) => {
        if (seq.current !== id) return;
        setData(res);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (seq.current !== id) return;
        if (err instanceof ApiClientError && err.status === 0) return; // aborted
        setError(err instanceof ApiClientError ? err : new ApiClientError(500, "ERROR", "Could not load records."));
        setLoading(false);
      });

    return () => controller.abort();
  }, [target]);

  const setParam = useCallback((key: string, value: string) => {
    setParams((p) => ({ ...p, [key]: value, ...(key !== "page" ? { page: "1" } : {}) }));
  }, []);

  const setPage = useCallback((page: number) => {
    setParams((p) => ({ ...p, page: String(page) }));
  }, []);

  const defaultsKey = JSON.stringify(defaults);
  const reset = useCallback(() => {
    setParams({ page: "1", ...defaults });
  }, [defaultsKey]);

  const activeFilterCount = Object.entries(params).filter(
    ([k, v]) => k !== "page" && v !== "" && v !== "ALL" && v !== (defaults[k] ?? ""),
  ).length;

  return { data, loading, error, params, setParam, setPage, reset, reload, activeFilterCount, target };
}

/** Small optimistic helper: apply → run → rollback on failure. */
export function useOptimisticList<T extends { id: number }>(rows: T[] | undefined) {
  const [override, setOverride] = useState<Partial<T> & { id: number } | null>(null);

  function optimistic(row: Partial<T> & { id: number }) {
    setOverride(row);
  }
  function rollback() {
    setOverride(null);
  }
  function commit() {
    setOverride(null);
  }

  const merged = rows?.map((r) => (override && r.id === override.id ? { ...r, ...override } : r));
  return { rows: merged, optimistic, rollback, commit };
}
