import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Pencil } from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { alerts, incidents, incidentAssets, users } from "@/db/schema";
import { getCurrentUser } from "@/server/auth";
import { getAsset } from "@/server/assets";
import { requirePositiveId } from "@/server/incidents";
import { listActivity } from "@/server/activity-queries";
import { Panel, PanelHeader, PageHeader } from "@/components/ui/panel";
import { Pill, ASSET_STATUS_TONE, SEVERITY_TONE, INCIDENT_STATUS_TONE } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { fmtDateTime, fmtRelative } from "@/lib/utils";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const asset = await getAsset(requirePositiveId((await params).id));
    return { title: `${asset.key} · ${asset.name}` };
  } catch {
    return { title: "Asset" };
  }
}

export default async function AssetDetailPage({ params }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const id = requirePositiveId((await params).id);
  let asset;
  try {
    asset = await getAsset(id);
  } catch {
    notFound();
  }

  const [linkedIncidents, linkedAlerts, activity, ownerRow] = await Promise.all([
    db
      .select({
        id: incidents.id,
        key: incidents.key,
        title: incidents.title,
        severity: incidents.severity,
        status: incidents.status,
        updatedAt: incidents.updatedAt,
      })
      .from(incidents)
      .innerJoin(incidentAssets, eq(incidentAssets.incidentId, incidents.id))
      .where(eq(incidentAssets.assetId, id)),
    db
      .select({
        id: alerts.id,
        key: alerts.key,
        title: alerts.title,
        severity: alerts.severity,
        status: alerts.status,
        detectedAt: alerts.detectedAt,
      })
      .from(alerts)
      .orderBy(desc(alerts.detectedAt))
      .limit(8),
    listActivity("100"),
    asset.ownerId
      ? db.select({ name: users.name, role: users.role }).from(users).where(eq(users.id, asset.ownerId)).limit(1)
      : Promise.resolve([]),
  ]);

  const assetActivity = activity.filter((a) => a.entityKey === asset.key || (a.entityType === "asset" && a.entityId === id));

  return (
    <div className="space-y-4">
      <Link
        href="/assets"
        className="mono inline-flex items-center gap-1.5 text-[11px] text-[var(--muted)] transition-colors hover:text-[var(--text)]"
      >
        <ArrowLeft size={13} /> Back to inventory
      </Link>

      <PageHeader
        eyebrow={`Asset · ${asset.key}`}
        title={asset.name}
        description={`${asset.type.replace("_", " ")} · ${asset.environment}${asset.ipAddress ? ` · ${asset.ipAddress}` : ""}`}
        actions={
          can(user.role, "update", "asset") ? (
            <Link href={`/assets?edit=${asset.id}`}>
              <Button variant="outline" size="sm">
                <Pencil size={13} /> Edit asset
              </Button>
            </Link>
          ) : (
            <span className="mono text-[11px] text-[var(--muted-2)]">read-only access</span>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-1">
          <PanelHeader title="Record" />
          <dl className="mt-4 space-y-3">
            <Row label="Status">
              <Pill tone={ASSET_STATUS_TONE[asset.status] ?? "neutral"}>{asset.status}</Pill>
            </Row>
            <Row label="Type">
              <span className="mono text-[12.5px]">{asset.type}</span>
            </Row>
            <Row label="Environment">
              <span className="mono text-[12.5px]">{asset.environment}</span>
            </Row>
            <Row label="Address">
              <span className="mono text-[12.5px]">{asset.ipAddress ?? "—"}</span>
            </Row>
            <Row label="Owner">
              <span className="text-[12.5px]">
                {asset.ownerName ? `${asset.ownerName}${ownerRow[0] ? ` · ${ownerRow[0].role}` : ""}` : "Unassigned"}
              </span>
            </Row>
            <Row label="Last seen">
              <span className="mono text-[12.5px]">
                {asset.lastSeen ? `${fmtDateTime(asset.lastSeen)} (${fmtRelative(asset.lastSeen)})` : "—"}
              </span>
            </Row>
            <Row label="Added">
              <span className="mono text-[12.5px]">{fmtDateTime(asset.createdAt)}</span>
            </Row>
          </dl>
        </Panel>

        <Panel className="lg:col-span-2">
          <PanelHeader title="Related incidents" meta={`${linkedIncidents.length} linked to this asset`} />
          {linkedIncidents.length ? (
            <ul className="mt-3 divide-y divide-[var(--border)]">
              {linkedIncidents.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link
                      href={`/incidents/${i.id}`}
                      className="block truncate text-[13px] font-medium underline-offset-4 hover:underline"
                    >
                      {i.title}
                    </Link>
                    <span className="mono text-[11px] text-[var(--muted-2)]">
                      {i.key} · updated {fmtRelative(i.updatedAt)}
                    </span>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Pill tone={SEVERITY_TONE[i.severity] ?? "neutral"} dot={false}>
                      {i.severity}
                    </Pill>
                    <Pill tone={INCIDENT_STATUS_TONE[i.status] ?? "neutral"} dot={false}>
                      {i.status.replace("_", " ")}
                    </Pill>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No incidents reference this asset"
              body="When an incident lists this asset as affected, it will appear here with its current severity and status."
            />
          )}

          <div className="mt-5 border-t border-[var(--border)] pt-4">
            <PanelHeader title="Recent alerts" meta="Latest detections across the estate" className="border-b-0 pb-0" />
            <ul className="mt-3 space-y-2.5">
              {linkedAlerts.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px]">{a.title}</p>
                    <span className="mono text-[10.5px] text-[var(--muted-2)]">
                      {a.key} · {fmtRelative(a.detectedAt)}
                    </span>
                  </div>
                  <Pill tone={SEVERITY_TONE[a.severity] ?? "neutral"} dot={false}>
                    {a.severity}
                  </Pill>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Activity" meta="Changes recorded against this asset" />
        {assetActivity.length ? (
          <ol className="mt-3 space-y-2.5">
            {assetActivity.slice(0, 12).map((a) => (
              <li key={a.id} className="grid gap-1 border-l border-[var(--border)] pl-3 sm:grid-cols-[160px_1fr] sm:gap-3">
                <span className="mono text-[10.5px] text-[var(--muted-2)]">{fmtDateTime(a.createdAt)}</span>
                <span className="text-[12.5px]">{a.summary}</span>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState title="No activity recorded" body="Changes to this asset will be logged here with actor and timestamp." />
        )}
      </Panel>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--border)] pb-2.5 last:border-b-0">
      <dt className="label">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}
