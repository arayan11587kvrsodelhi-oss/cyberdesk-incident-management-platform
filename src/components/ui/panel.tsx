import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** An instrument plate: tracked micro-caps header, hairline rule, dense readout. */
export function Panel({
  children,
  className,
  bleed = false,
}: {
  children: ReactNode;
  className?: string;
  bleed?: boolean;
}) {
  return (
    <section
      className={cn(
        "border border-[var(--border)] bg-[var(--panel)]",
        !bleed && "p-4 sm:p-5",
        className,
      )}
      style={{ borderRadius: 4 }}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  meta,
  action,
  className,
}: {
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[var(--border)] pb-3",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="label text-[var(--muted)]">{title}</h2>
        {meta ? <div className="mt-1 text-[12px] text-[var(--muted-2)]">{meta}</div> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </header>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-5 border-b border-[var(--border)] pb-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="label text-[var(--accent)]">{eyebrow}</p>
          <h1 className="mt-2 text-[26px] leading-[1.1] font-semibold tracking-[-0.02em] sm:text-[30px]">{title}</h1>
          {description ? (
            <p className="mt-2 max-w-[68ch] text-[13px] leading-relaxed text-[var(--muted)]">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
