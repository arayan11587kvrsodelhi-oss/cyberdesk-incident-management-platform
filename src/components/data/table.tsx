import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function TableShell({ children, minWidth = 900 }: { children: ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function Th({
  children,
  className,
  scope = "col",
}: {
  children: ReactNode;
  className?: string;
  scope?: "col" | "row";
}) {
  return (
    <th
      scope={scope}
      className={cn(
        "label border-b border-[var(--border)] bg-[var(--panel-2)] px-3 py-2.5 font-medium whitespace-nowrap",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <td className={cn("border-b border-[var(--border)] px-3 py-3 align-middle text-[13px]", className)}>
      {children}
    </td>
  );
}

/** First cell carries the severity spine — a colour tick scannable down the page edge. */
export function Spine({ color }: { color: string }) {
  return (
    <td className="w-[3px] border-b border-[var(--border)] p-0">
      <span
        className="block h-full min-h-[44px] w-[3px]"
        style={{ background: color }}
        aria-hidden
      />
    </td>
  );
}

export const SPINE_COLOR: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#f59e0b",
  LOW: "#38bdf8",
  OPEN: "#ef4444",
  INVESTIGATING: "#35b5e0",
  CONTAINED: "#f59e0b",
  RESOLVED: "#34d399",
  CLOSED: "#6a717b",
  NEW: "#ef4444",
  ACKNOWLEDGED: "#f59e0b",
  HEALTHY: "#34d399",
  WARNING: "#f59e0b",
  OFFLINE: "#6a717b",
  TODO: "#6a717b",
  IN_PROGRESS: "#35b5e0",
  BLOCKED: "#ef4444",
  DONE: "#34d399",
  TODO_STATUS: "#6a717b",
};

export function spineFor(...keys: (string | null | undefined)[]) {
  for (const k of keys) {
    if (k && SPINE_COLOR[k]) return SPINE_COLOR[k];
  }
  return "var(--border-strong)";
}
