import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Tone = "critical" | "high" | "medium" | "low" | "neutral" | "info" | "positive" | "warn";

const TONE: Record<Tone, { fg: string; bg: string; bar?: string }> = {
  critical: { fg: "#ef4444", bg: "color-mix(in oklab, #ef4444 14%, transparent)" },
  high: { fg: "#f97316", bg: "color-mix(in oklab, #f97316 14%, transparent)" },
  medium: { fg: "#f59e0b", bg: "color-mix(in oklab, #f59e0b 14%, transparent)" },
  low: { fg: "#38bdf8", bg: "color-mix(in oklab, #38bdf8 14%, transparent)" },
  neutral: { fg: "var(--muted)", bg: "color-mix(in oklab, var(--text) 7%, transparent)" },
  info: { fg: "#35b5e0", bg: "color-mix(in oklab, #35b5e0 14%, transparent)" },
  positive: { fg: "#34d399", bg: "color-mix(in oklab, #34d399 14%, transparent)" },
  warn: { fg: "#f59e0b", bg: "color-mix(in oklab, #f59e0b 14%, transparent)" },
};

export const SEVERITY_TONE: Record<string, Tone> = {
  CRITICAL: "critical",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
};

export const INCIDENT_STATUS_TONE: Record<string, Tone> = {
  OPEN: "critical",
  INVESTIGATING: "info",
  CONTAINED: "warn",
  RESOLVED: "positive",
  CLOSED: "neutral",
};

export const ALERT_STATUS_TONE: Record<string, Tone> = {
  NEW: "critical",
  ACKNOWLEDGED: "warn",
  INVESTIGATING: "info",
  RESOLVED: "positive",
};

export const ASSET_STATUS_TONE: Record<string, Tone> = {
  HEALTHY: "positive",
  WARNING: "warn",
  CRITICAL: "critical",
  OFFLINE: "neutral",
};

export const TASK_PRIORITY_TONE: Record<string, Tone> = {
  CRITICAL: "critical",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
};

export const TASK_STATUS_TONE: Record<string, Tone> = {
  TODO: "neutral",
  IN_PROGRESS: "info",
  BLOCKED: "critical",
  DONE: "positive",
};

export function Pill({
  tone = "neutral",
  children,
  className,
  dot = true,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  const t = TONE[tone] ?? TONE.neutral;
  return (
    <span
      className={cn(
        "mono inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-[3px] border px-1.5 py-[3px] text-[10px] font-medium tracking-[0.1em] uppercase",
        className,
      )}
      style={{ color: t.fg, background: t.bg, borderColor: `color-mix(in oklab, ${t.fg} 35%, transparent)` }}
    >
      {dot ? <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: t.fg }} aria-hidden /> : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="mono rounded-[3px] border border-[var(--border)] px-1.5 py-[2px] text-[10px] text-[var(--muted)]">
      {children}
    </span>
  );
}
