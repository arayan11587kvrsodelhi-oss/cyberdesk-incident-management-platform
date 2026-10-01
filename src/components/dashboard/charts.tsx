import Link from "next/link";
import { SEVERITY_TONE, Pill, INCIDENT_STATUS_TONE, ALERT_STATUS_TONE, ASSET_STATUS_TONE, type Tone } from "@/components/ui/badge";
import type { Tone as ToneType } from "@/components/ui/badge";

const TONE_HEX: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#38bdf8",
  info: "#38bdf8",
  positive: "#22c55e",
  warn: "#f59e0b",
  neutral: "#6a717b",
};

function hex(tone: ToneType) {
  return TONE_HEX[tone] ?? TONE_HEX.neutral;
}

function pretty(v: string) {
  return v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function BarBreakdown({
  title,
  rows,
  toneFor,
  total,
  href,
  emptyHint,
}: {
  title: string;
  rows: { key: string; n: number }[];
  toneFor: (key: string) => ToneType;
  total: number;
  href?: { label: string; href: string };
  emptyHint?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.n));

  if (total === 0) {
    return (
      <div>
        <p className="label mb-3">{title}</p>
        <p className="text-[12.5px] text-[var(--muted)]">{emptyHint ?? "No records yet."}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="label">{title}</p>
        <span className="mono text-[11px] text-[var(--muted-2)]">{total} total</span>
      </div>
      <ul className="space-y-2.5">
        {rows.map((r) => {
          const tone = toneFor(r.key);
          const pct = total > 0 ? Math.round((r.n / total) * 100) : 0;
          return (
            <li key={r.key} className="grid grid-cols-[92px_1fr_58px] items-center gap-3">
              <span className="mono truncate text-[11px] text-[var(--muted)]">{pretty(r.key)}</span>
              <span className="h-2 w-full overflow-hidden rounded-[2px] bg-[var(--panel-2)]">
                <span
                  className="block h-full rounded-[2px]"
                  style={{
                    width: `${Math.max(3, (r.n / max) * 100)}%`,
                    background: hex(tone),
                    transition: "width 400ms cubic-bezier(0.16,1,0.3,1)",
                  }}
                />
              </span>
              <span className="mono text-right text-[12px] tabular-nums">
                {r.n}
                <span className="ml-1 text-[10px] text-[var(--muted-2)]">{pct}%</span>
              </span>
            </li>
          );
        })}
      </ul>
      {href ? (
        <Link
          href={href.href}
          className="mono mt-3 inline-block text-[11px] text-[var(--accent-2)] underline-offset-4 hover:underline"
        >
          {href.label} →
        </Link>
      ) : null}
    </div>
  );
}

export function AlertActivityChart({ series }: { series: { day: string; n: number }[] }) {
  const max = Math.max(1, ...series.map((s) => s.n));
  const total = series.reduce((sum, s) => sum + s.n, 0);

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="label">Alert activity · last 14 days</p>
        <span className="mono text-[11px] text-[var(--muted-2)]">{total} alerts</span>
      </div>

      <div className="flex h-[148px] items-end gap-[3px]" role="img" aria-label={`Alert activity over the last 14 days, ${total} alerts total`}>
        {series.map((s) => {
          const height = s.n === 0 ? 2 : Math.max(6, (s.n / max) * 100);
          const label = `${s.day}: ${s.n} alert${s.n === 1 ? "" : "s"}`;
          return (
            <div key={s.day} className="group relative flex h-full flex-1 items-end">
              <div
                className="w-full rounded-[2px] transition-[height,background-color] duration-300"
                style={{
                  height: `${height}%`,
                  background:
                    s.n === 0
                      ? "var(--border)"
                      : `color-mix(in oklab, var(--accent-2) ${45 + Math.round((s.n / max) * 55)}%, transparent)`,
                }}
                title={label}
              />
              <span className="sr-only">{label}</span>
            </div>
          );
        })}
      </div>

      <div className="mono mt-2 flex justify-between text-[10px] text-[var(--muted-2)]">
        <span>{series[0]?.day.slice(5)}</span>
        <span>{series[Math.floor(series.length / 2)]?.day.slice(5)}</span>
        <span>{series[series.length - 1]?.day.slice(5)}</span>
      </div>
    </div>
  );
}

export function StackedStatus({ rows }: { rows: { key: string; n: number }[] }) {
  const total = rows.reduce((s, r) => s + r.n, 0);
  if (total === 0) return <p className="text-[12.5px] text-[var(--muted)]">No incidents recorded yet.</p>;
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-[2px]" role="img" aria-label="Incident status breakdown">
        {rows.map((r) => (
          <span
            key={r.key}
            title={`${pretty(r.key)}: ${r.n}`}
            style={{
              width: `${(r.n / total) * 100}%`,
              background: hex(r.key === "OPEN" ? "critical" : r.key === "INVESTIGATING" ? "info" : r.key === "CONTAINED" ? "warn" : r.key === "RESOLVED" ? "positive" : "neutral"),
            }}
          />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-[1px]"
                style={{
                  background: hex(
                    r.key === "OPEN" ? "critical" : r.key === "INVESTIGATING" ? "info" : r.key === "CONTAINED" ? "warn" : r.key === "RESOLVED" ? "positive" : "neutral",
                  ),
                }}
                aria-hidden
              />
              <span className="mono text-[11px] text-[var(--muted)]">{pretty(r.key)}</span>
            </span>
            <span className="mono text-[12px] tabular-nums">{r.n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export { SEVERITY_TONE, INCIDENT_STATUS_TONE, ALERT_STATUS_TONE, ASSET_STATUS_TONE, Pill, pretty };
