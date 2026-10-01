import Link from "next/link";
import type { Metadata } from "next";
import { ArrowDownRight, ArrowUpRight, Activity, Inbox, ShieldAlert, Radio, ListChecks } from "lucide-react";
import { getCurrentUser } from "@/server/auth";
import { getDashboardStats } from "@/server/dashboard";
import { Panel } from "@/components/ui/panel";
import { NewIncidentButton } from "@/components/dashboard/new-incident-button";
import { can, type Role } from "@/lib/permissions";
import {
  AlertActivityChart,
  BarBreakdown,
  StackedStatus,
  INCIDENT_STATUS_TONE,
  SEVERITY_TONE,
} from "@/components/dashboard/charts";
import { fmtRelative } from "@/lib/utils";
import type { Tone } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function Kpi({
  label,
  value,
  note,
  icon,
  tone = "var(--text)",
  delta,
}: {
  label: string;
  value: number;
  note: string;
  icon: React.ReactNode;
  tone?: string;
  delta?: number;
}) {
  return (
    <div className="min-w-0 border-[var(--border)] px-4 py-4 sm:px-5 lg:border-l lg:first:border-l-0">
      <div className="flex items-center justify-between gap-2">
        <p className="label truncate">{label}</p>
        <span style={{ color: tone }} aria-hidden>
          {icon}
        </span>
      </div>
      <p className="mono mt-2.5 text-[44px] leading-none font-medium tracking-[-0.03em] tabular-nums lg:text-[56px]">
        {value}
      </p>
      <div className="mt-2.5 flex items-center gap-2">
        {typeof delta === "number" && delta !== 0 ? (
          <span
            className="mono flex items-center gap-0.5 text-[11px]"
            style={{ color: delta > 0 ? "var(--crit)" : "var(--accent)" }}
          >
            {delta > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(delta)}
          </span>
        ) : null}
        <p className="truncate text-[11.5px] text-[var(--muted-2)]">{note}</p>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const [user, stats] = await Promise.all([getCurrentUser(), getDashboardStats()]);
  const firstName = user?.name.trim().split(/\s+/)[0] ?? "there";
  const { kpis } = stats;
  const canCreate = user ? can(user.role as Role, "create", "incident") : false;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="mono text-[10px] tracking-[0.22em] text-[var(--muted-2)] uppercase">CYBERDESK · Security Operations</p>
        <NewIncidentButton canCreate={canCreate} />
      </div>

      <header className="border-b border-[var(--border)] pb-5">
        <p className="label text-[var(--accent)]">Security operations overview</p>
        <h1 className="mt-2 text-[30px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[38px]">
          {greeting()}, {firstName}
        </h1>
        <p className="mt-2.5 max-w-[70ch] text-[13px] leading-relaxed text-[var(--muted)]">
          Live aggregation over the workspace database — {kpis.totalIncidents} incidents,{" "}
          {kpis.totalAlerts} alerts and {kpis.totalAssets} assets in the simulated demo estate.
        </p>
      </header>

      {/* KPI band — uneven columns divided by hairlines, no card grid */}
      <section
        aria-label="Key metrics"
        className="grid grid-cols-2 border border-[var(--border)] bg-[var(--panel)] md:grid-cols-[1.3fr_1fr_1fr_1fr]"
        style={{ borderRadius: 4 }}
      >
        <Kpi
          label="Open incidents"
          value={kpis.openIncidents}
          note="vs. 30 days ago"
          delta={kpis.openIncidentDelta}
          icon={<ShieldAlert size={16} />}
          tone="var(--crit)"
        />
        <Kpi
          label="Critical alerts"
          value={kpis.criticalAlerts}
          note={`${kpis.unacknowledgedAlerts} still new`}
          icon={<Radio size={16} />}
          tone="var(--warn)"
        />
        <Kpi
          label="Monitored assets"
          value={kpis.monitoredAssets}
          note="inventoried estate"
          icon={<Inbox size={16} />}
          tone="var(--accent-2)"
        />
        <Kpi
          label="Active tasks"
          value={kpis.activeTasks}
          note={`${kpis.noteCount} investigation notes`}
          icon={<ListChecks size={16} />}
          tone="var(--accent)"
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-12">
        <Panel className="lg:col-span-7">
          <PanelHeaderRow title="Incident severity distribution" meta="Count of records by severity" />
          <div className="pt-4">
            <BarBreakdown
              title="By severity"
              rows={stats.severityDistribution.map((r) => ({ key: r.severity, n: r.n }))}
              toneFor={(k) => (SEVERITY_TONE[k] as Tone) ?? "neutral"}
              total={kpis.totalIncidents}
              href={{ label: "Open incident ledger", href: "/incidents" }}
              emptyHint="No incident severity data — severity distribution will appear when incidents are recorded."
            />
          </div>
        </Panel>

        <Panel className="lg:col-span-5">
          <PanelHeaderRow title="Incident status breakdown" meta="Where the queue currently sits" />
          <div className="pt-4">
            <StackedStatus rows={stats.statusBreakdown.map((r) => ({ key: r.status, n: r.n }))} />
            <div className="mt-4 border-t border-[var(--border)] pt-4">
              <p className="label mb-2.5">Open workload by analyst</p>
              {stats.workload.length ? (
                <ul className="space-y-1.5">
                  {stats.workload.map((w) => (
                    <li key={w.name} className="flex items-center justify-between gap-3">
                      <span className="truncate text-[12.5px]">{w.name}</span>
                      <span className="mono text-[12px] tabular-nums text-[var(--muted)]">{w.n} open</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-col items-center gap-1.5 py-4 text-center">
                  <p className="text-[12.5px] text-[var(--muted)]">No assigned incidents</p>
                  <p className="text-[11.5px] text-[var(--muted-2)]">Assigned incident workload will appear here.</p>
                </div>
              )}
            </div>
          </div>
        </Panel>

        <Panel className="lg:col-span-7">
          <PanelHeaderRow
            title="Alert activity"
            meta="Detected volume over the last 14 days"
            action={
              <Link href="/alerts" className="mono text-[11px] text-[var(--accent-2)] underline-offset-4 hover:underline">
                Alert queue →
              </Link>
            }
          />
          <div className="pt-4">
            <AlertActivityChart series={stats.alertActivity} />
            <div className="mt-5 border-t border-[var(--border)] pt-4">
              <BarBreakdown
                title="Alerts by source"
                rows={stats.alertSourceBreakdown.map((r) => ({ key: r.source, n: r.n }))}
                toneFor={() => "info"}
                total={kpis.totalAlerts}
              />
            </div>
          </div>
        </Panel>

        <Panel className="lg:col-span-5">
          <PanelHeaderRow title="Asset health" meta="Estate status at this moment" />
          <div className="pt-4">
            <BarBreakdown
              title="By status"
              rows={stats.assetHealth.map((r) => ({ key: r.status, n: r.n }))}
              toneFor={(k) =>
                (k === "HEALTHY" ? "positive" : k === "WARNING" ? "warn" : k === "CRITICAL" ? "critical" : "neutral") as Tone
              }
              total={kpis.totalAssets}
              href={{ label: "Open asset inventory", href: "/assets" }}
              emptyHint="No assets have been added to the inventory yet."
            />
          </div>

          <div className="mt-5 border-t border-[var(--border)] pt-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="label">Recent activity</p>
              <Activity size={13} className="text-[var(--muted-2)]" aria-hidden />
            </div>
            {stats.recentActivity.length ? (
              <ul className="space-y-2.5">
                {stats.recentActivity.slice(0, 6).map((a) => (
                  <li key={a.id} className="flex gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-[12.5px] leading-snug break-words">{a.summary}</p>
                      <p className="mono mt-0.5 text-[10px] text-[var(--muted-2)]">
                        {fmtRelative(a.createdAt)} · {a.action}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center gap-1.5 py-4 text-center">
                <p className="text-[12.5px] text-[var(--muted)]">No activity recorded yet</p>
                <p className="text-[11.5px] text-[var(--muted-2)]">Workspace events will appear here as they happen.</p>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-3">
              <Link href="/incidents" className="mono text-[11px] text-[var(--accent-2)] underline-offset-4 hover:underline">
                View incident ledger →
              </Link>
              <Link href="/investigations" className="mono text-[11px] text-[var(--accent-2)] underline-offset-4 hover:underline">
                Investigation log →
              </Link>
            </div>
          </div>
        </Panel>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-[var(--border)] pt-4">
        <p className="label">
          Incident status legend ·{" "}
          <span className="normal-case tracking-normal">
            {Object.keys(INCIDENT_STATUS_TONE).join(" · ")}
          </span>
        </p>
        <p className="mono ml-auto text-[10px] text-[var(--muted-2)]">
          All figures aggregated from PostgreSQL · refreshed on load
        </p>
      </div>
    </div>
  );
}

function PanelHeaderRow({ title, meta, action }: { title: string; meta: string; action?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-3">
      <div>
        <h2 className="label">{title}</h2>
        <p className="mt-1 text-[12px] text-[var(--muted-2)]">{meta}</p>
      </div>
      {action}
    </header>
  );
}
