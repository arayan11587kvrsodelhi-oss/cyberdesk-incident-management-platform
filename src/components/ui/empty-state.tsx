import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  body,
  action,
  secondary,
  className,
}: {
  icon?: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
  secondary?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-14 text-center",
        className,
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center border border-[var(--border-strong)] bg-[var(--panel-2)] text-[var(--muted)]" style={{ borderRadius: 4 }}>
        {icon}
      </div>
      <div className="max-w-[46ch]">
        <h3 className="text-[14px] font-semibold tracking-[-0.01em]">{title}</h3>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--muted)]">{body}</p>
      </div>
      {action || secondary ? (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">{action}{secondary}</div>
      ) : null}
    </div>
  );
}

export function ErrorState({
  title,
  body,
  action,
  code,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  code?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="flex h-11 w-11 items-center justify-center border border-[color-mix(in_oklab,var(--crit)_50%,transparent)] bg-[color-mix(in_oklab,var(--crit)_10%,transparent)] text-[var(--crit)]" style={{ borderRadius: 4 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M12 8v5M12 17h.01" strokeLinecap="round" />
          <path d="M10.3 3.9 2.6 17.4A1.9 1.9 0 0 0 4.3 20.3h15.4a1.9 1.9 0 0 0 1.7-2.9L13.7 3.9a1.9 1.9 0 0 0-3.4 0Z" />
        </svg>
      </div>
      <div className="max-w-[48ch]">
        <h3 className="text-[14px] font-semibold tracking-[-0.01em]">{title}</h3>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--muted)]">{body}</p>
        {code ? <p className="label mt-2 text-[var(--muted-2)]">error · {code}</p> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
