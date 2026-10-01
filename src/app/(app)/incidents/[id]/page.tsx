import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/server/auth";
import {
  getIncident,
  incidentAssetIds,
  listAssignableUsers,
  listAssetsLite,
  requirePositiveId,
} from "@/server/incidents";
import { db } from "@/db";
import { alerts, assets, investigationNotes, tasks, users as usersTable } from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { listActivity } from "@/server/activity-queries";
import { IncidentDetail } from "@/components/incidents/incident-detail";
import { ApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = requirePositiveId((await params).id);
  try {
    const incident = await getIncident(id);
    return { title: `${incident.key} · ${incident.title}` };
  } catch {
    return { title: "Incident" };
  }
}

export default async function IncidentDetailPage({ params }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const id = requirePositiveId((await params).id);

  let incident;
  try {
    incident = await getIncident(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const [assetIds, users, assetOptions, noteRows, taskRows, alertRows, allActivity] = await Promise.all([
    incidentAssetIds(id),
    listAssignableUsers(),
    listAssetsLite(),
    db
      .select({
        id: investigationNotes.id,
        title: investigationNotes.title,
        body: investigationNotes.body,
        createdAt: investigationNotes.createdAt,
        updatedAt: investigationNotes.updatedAt,
        authorName: usersTable.name,
      })
      .from(investigationNotes)
      .innerJoin(usersTable, eq(investigationNotes.authorId, usersTable.id))
      .where(eq(investigationNotes.incidentId, id))
      .orderBy(desc(investigationNotes.createdAt)),
    db
      .select({
        id: tasks.id,
        key: tasks.key,
        title: tasks.title,
        description: tasks.description,
        priority: tasks.priority,
        status: tasks.status,
        dueDate: tasks.dueDate,
        assigneeName: usersTable.name,
      })
      .from(tasks)
      .leftJoin(usersTable, eq(tasks.assigneeId, usersTable.id))
      .where(eq(tasks.incidentId, id))
      .orderBy(desc(tasks.createdAt)),
    db
      .select({
        id: alerts.id,
        key: alerts.key,
        title: alerts.title,
        severity: alerts.severity,
        status: alerts.status,
        source: alerts.source,
        detectedAt: alerts.detectedAt,
      })
      .from(alerts)
      .where(eq(alerts.incidentId, id))
      .orderBy(desc(alerts.detectedAt)),
    listActivity("200"),
  ]);

  const affectedAssets = assetIds.length
    ? await db
        .select({
          id: assets.id,
          key: assets.key,
          name: assets.name,
          type: assets.type,
          status: assets.status,
          ipAddress: assets.ipAddress,
        })
        .from(assets)
        .where(inArray(assets.id, assetIds))
    : [];

  const activity = allActivity
    .filter(
      (a) =>
        (a.entityType === "incident" && a.entityId === id) ||
        (a.entityKey && a.entityKey === incident.key) ||
        (a.entityType === "note" && noteRows.some((n) => n.id === a.entityId)) ||
        (a.entityType === "task" && taskRows.some((t) => t.id === a.entityId)),
    )
    .slice(0, 40)
    .map((a) => ({
      id: a.id,
      actorName: a.actorName,
      action: a.action,
      summary: a.summary,
      createdAt: a.createdAt.toISOString(),
    }));

  return (
    <IncidentDetail
      incident={{
        id: incident.id,
        key: incident.key,
        title: incident.title,
        description: incident.description,
        severity: incident.severity,
        status: incident.status,
        tags: incident.tags,
        createdAt: incident.createdAt.toISOString(),
        updatedAt: incident.updatedAt.toISOString(),
        assigneeId: incident.assigneeId,
        assigneeName: incident.assigneeName,
      }}
      viewer={{ id: user.id, role: user.role, name: user.name }}
      users={users.map((u) => ({ id: u.id, name: u.name, role: u.role }))}
      assets={assetOptions}
      assetIds={assetIds}
      affectedAssets={affectedAssets}
      notes={noteRows.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        createdAt: n.createdAt.toISOString(),
        updatedAt: n.updatedAt.toISOString(),
        authorName: n.authorName,
      }))}
      tasks={taskRows.map((t) => ({
        id: t.id,
        key: t.key,
        title: t.title,
        description: t.description,
        priority: t.priority,
        status: t.status,
        dueDate: t.dueDate,
        assigneeName: t.assigneeName,
      }))}
      alerts={alertRows.map((a) => ({
        id: a.id,
        key: a.key,
        title: a.title,
        severity: a.severity,
        status: a.status,
        source: a.source,
        detectedAt: a.detectedAt.toISOString(),
      }))}
      activity={activity}
    />
  );
}
