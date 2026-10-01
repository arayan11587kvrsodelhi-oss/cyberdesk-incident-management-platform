import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton h-3 w-full", className)} aria-hidden />;
}

export function SkeletonRow({ cols = 6 }: { cols?: number }) {
  return (
    <div className="flex items-center gap-4 border-b border-[var(--border)] px-4 py-3.5">
      <div className="h-8 w-[3px] shrink-0 bg-[var(--panel-2)]" />
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className={i === 1 ? "h-3 flex-[3]" : "h-3 flex-[1]"} />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div role="status" aria-label="Loading records" className="divide-y divide-[var(--border)]">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} cols={cols} />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="border border-[var(--border)] bg-[var(--panel)] p-4"
          style={{ borderRadius: 4 }}
        >
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="mt-4 h-9 w-24" />
          <Skeleton className="mt-4 h-2.5 w-32" />
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading page" className="space-y-5">
      <Skeleton className="h-3 w-40" />
      <Skeleton className="h-9 w-[min(420px,80%)]" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border border-[var(--border)] bg-[var(--panel)] p-4" style={{ borderRadius: 4 }}>
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="mt-4 h-9 w-24" />
          </div>
        ))}
      </div>
      <TableSkeleton rows={6} />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
