import type { ReactNode } from "react";
import { Mark, Wordmark } from "@/components/brand/mark";

export function AuthShell({
  eyebrow,
  title,
  intro,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* Material: a dark rack aisle, heavily scrimmed so type stays legible */}
      <aside className="relative hidden overflow-hidden border-r border-[var(--border)] bg-[var(--bg)] lg:block">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,10,12,0.72)_0%,rgba(8,10,12,0.55)_45%,rgba(8,10,12,0.95)_100%)]" />
        <div className="absolute inset-0 grid-bg" />
        <div className="relative flex h-full flex-col justify-between p-8 xl:p-10">
          <div className="flex items-center gap-2.5 text-[var(--text)]">
            <Mark size={26} />
            <Wordmark />
          </div>

          <div className="max-w-[46ch]">
            <p className="label text-[var(--accent)]">Simulated demo environment</p>
            <h2 className="mt-3 text-[30px] leading-[1.12] font-semibold tracking-[-0.025em]">
              A quiet console for loud days.
            </h2>
            <p className="mt-3 text-[13px] leading-relaxed text-[var(--muted)]">
              Incidents, alerts, assets, investigation notes and tasks in one workspace — with every record
              derived from the database, not from a mock.
            </p>
          </div>

          <div className="border-t border-[var(--border)] pt-4">
            <p className="text-[11.5px] leading-relaxed text-[var(--muted-2)]">
              CYBERDESK is a portfolio project. All incidents, alerts, assets, people and notes in this
              workspace are fictional, seeded demonstration data — not real security events, customers,
              telemetry or threat intelligence.
            </p>
          </div>
        </div>
      </aside>

      <main className="flex flex-col justify-center bg-[var(--bg)] px-5 py-10 sm:px-10 lg:px-12">
        <div className="mx-auto w-full max-w-[420px]">
          <div className="mb-7 flex items-center gap-2.5 lg:hidden">
            <Mark size={24} />
            <Wordmark />
          </div>

          <p className="label text-[var(--accent)]">{eyebrow}</p>
          <h1 className="mt-2.5 text-[26px] leading-[1.12] font-semibold tracking-[-0.025em]">{title}</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--muted)]">{intro}</p>

          <div className="mt-6">{children}</div>

          {footer ? <div className="mt-6 border-t border-[var(--border)] pt-4">{footer}</div> : null}
        </div>
      </main>
    </div>
  );
}


