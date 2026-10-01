"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
  label = "records",
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
  label?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3">
      <p className="mono text-[11px] text-[var(--muted)]">
        {from}–{to} of {total} {label}
      </p>
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="ghost"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
          <span className="hidden sm:inline">Prev</span>
        </Button>
        <span className="mono px-1 text-[11px] text-[var(--muted)]">
          {page} / {pages}
        </span>
        <Button
          size="sm"
          variant="ghost"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          aria-label="Next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  );
}
