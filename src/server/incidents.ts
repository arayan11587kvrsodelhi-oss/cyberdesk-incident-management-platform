import { count, desc, eq, inArray, sql } from "drizzle-orm";
import type { AnyPgColumn, AnyPgTable } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { assets, incidentAssets, incidents, users } from "@/db/schema";
import { incidentSchema, incidentUpdateSchema } from "@/validators";
import { ApiError } from "@/lib/api-error";
import { parseOrThrow } from "@/lib/api-error";
import type { SessionUser } from "@/server/auth";
import { assertPermission, notFound } from "@/server/guard";
import { logActivity } from "@/server/activity";

export type IncidentFilters = {
  q?: string;
  severity?: string;
  status?: string;
  assignee?: string;
  page?: number;
  pageSize?: number;
  sort?: "created" | "updated" | "severity";
};

/** Human-readable, monotonically growing record key: INC-0007, ALT-0031 …
 *  Derived from the highest existing numeric suffix, not the row count — so
 *  deleting a middle record can never cause a key collision (unique violation). */
export async function nextKey(prefix: string, table: AnyPgTable, keyCol: AnyPgColumn) {
  const [row] = await db
    .select({
      n: sql<number>`coalesce(max(nullif(split_part(${keyCol}, '-', 2), '')::integer), 0)`,
    })
    .from(table);
  const n = (row?.n ?? 0) + 1;
  return `${prefix}-${String(n).padStart(4, "0")}`;
}

export async function listIncidents(f: IncidentFilters) {
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, f.pageSize ?? 10));

  const conditions = [];
  if (f.severity && f.severity !== "ALL") {
    conditions.push(sql`${incidents.severity} = ${f.severity}::severity`);
  }
  if (f.status && f.status !== "ALL") {
    conditions.push(sql`${incidents.status} = ${f.status}::incident_status`);
  }
  if (f.assignee && f.assignee !== "ALL") {
    conditions.push(
      f.assignee === "NONE"
        ? sql`${incidents.assigneeId} is null`
        : sql`${incidents.assigneeId} = ${Number(f.assignee)}`,
    );
  }
  if (f.q && f.q.trim()) {
    const like = `%${f.q.trim().toLowerCase()}%`;
    conditions.push(
      sql`(lower(${incidents.title}) like ${like} or lower(${incidents.key}) like ${like} or lower(${incidents.tags}) like ${like})`,
    );
  }

  const where = conditions.length ? sql.join(conditions, sql` and `) : undefined;
  const orderBy =
    f.sort === "severity"
      ? [sql`case ${incidents.severity} when 'CRITICAL' then 0 when 'HIGH' then 1 when 'MEDIUM' then 2 else 3 end`, desc(incidents.createdAt)]
      : f.sort === "created"
        ? [desc(incidents.createdAt)]
        : [desc(incidents.updatedAt)];

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: incidents.id,
        key: incidents.key,
        title: incidents.title,
        severity: incidents.severity,
        status: incidents.status,
        tags: incidents.tags,
        createdAt: incidents.createdAt,
        updatedAt: incidents.updatedAt,
        assigneeId: incidents.assigneeId,
        assigneeName: users.name,
      })
      .from(incidents)
      .leftJoin(users, eq(incidents.assigneeId, users.id))
      .where(where)
      .orderBy(...orderBy)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ n: count() }).from(incidents).where(where),
  ]);

  const ids = rows.map((r) => r.id);
  const assetLinks = ids.length
    ? await db
        .select({ incidentId: incidentAssets.incidentId, name: assets.name, key: assets.key })
        .from(incidentAssets)
        .innerJoin(assets, eq(incidentAssets.assetId, assets.id))
        .where(inArray(incidentAssets.incidentId, ids))
    : [];

  const assetMap = new Map<number, string[]>();
  for (const link of assetLinks) {
    const list = assetMap.get(link.incidentId) ?? [];
    if (!list.includes(link.name)) list.push(link.name);
    assetMap.set(link.incidentId, list);
  }

  return {
    rows: rows.map((r) => ({ ...r, assets: assetMap.get(r.id) ?? [] })),
    total: totalRow[0]?.n ?? 0,
    page,
    pageSize,
  };
}

export async function getIncident(id: number) {
  const [row] = await db
    .select({
      id: incidents.id,
      key: incidents.key,
      title: incidents.title,
      description: incidents.description,
      severity: incidents.severity,
      status: incidents.status,
      tags: incidents.tags,
      createdAt: incidents.createdAt,
      updatedAt: incidents.updatedAt,
      assigneeId: incidents.assigneeId,
      assigneeName: users.name,
      createdById: incidents.createdById,
    })
    .from(incidents)
    .leftJoin(users, eq(incidents.assigneeId, users.id))
    .where(eq(incidents.id, id))
    .limit(1);
  if (!row) throw notFound("incident");
  return row;
}

export async function incidentAssetIds(id: number) {
  const links = await db
    .select({ assetId: incidentAssets.assetId })
    .from(incidentAssets)
    .where(eq(incidentAssets.incidentId, id));
  return links.map((l) => l.assetId);
}

export async function createIncident(user: SessionUser, input: unknown) {
  assertPermission(user, "create", "incident");
  const data = parseOrThrow(incidentSchema, input);

  if (data.assigneeId) {
    const [a] = await db.select({ id: users.id }).from(users).where(eq(users.id, data.assigneeId)).limit(1);
    if (!a) throw new ApiError(422, "INVALID_ASSIGNEE", "That analyst no longer exists. Choose another.");
  }

  const key = await nextKey("INC", incidents, incidents.key);
  const [created] = await db
    .insert(incidents)
    .values({
      key,
      title: data.title,
      description: data.description,
      severity: data.severity,
      status: data.status,
      assigneeId: data.assigneeId ?? null,
      createdById: user.id,
      tags: data.tags,
    })
    .returning();

  if (data.assetIds.length) {
    await db.insert(incidentAssets).values(
      data.assetIds.map((assetId) => ({ incidentId: created.id, assetId })),
    ).onConflictDoNothing();
  }

  await logActivity({
    actorId: user.id,
    actorName: user.name,
    action: "incident.created",
    entityType: "incident",
    entityId: created.id,
    entityKey: created.key,
    summary: `${user.name} opened ${created.key} — “${created.title}” (${created.severity})`,
  });

  return created;
}

const SEVERITY_LABEL: Record<string, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export async function updateIncident(user: SessionUser, id: number, input: unknown) {
  assertPermission(user, "update", "incident");
  const data = parseOrThrow(incidentUpdateSchema, input);

  const before = await getIncident(id);
  const patch: Partial<typeof incidents.$inferInsert> = { updatedAt: new Date() };
  const changes: string[] = [];

  if (data.title !== undefined && data.title !== before.title) changes.push("title");
  if (data.description !== undefined) patch.description = data.description;
  if (data.severity !== undefined && data.severity !== before.severity) {
    patch.severity = data.severity;
    changes.push(`severity → ${SEVERITY_LABEL[data.severity]}`);
  }
  if (data.status !== undefined && data.status !== before.status) {
    patch.status = data.status;
    changes.push(`status → ${data.status.replace("_", " ").toLowerCase()}`);
  }
  if (data.assigneeId !== undefined) {
    const next = data.assigneeId ?? null;
    if (next !== before.assigneeId) {
      if (next) {
        const [assignee] = await db.select({ name: users.name }).from(users).where(eq(users.id, next)).limit(1);
        if (!assignee) throw new ApiError(422, "INVALID_ASSIGNEE", "That analyst no longer exists. Choose another.");
        changes.push(`assigned to ${assignee.name}`);
      } else changes.push("unassigned");
      patch.assigneeId = next;
    }
  }
  if (data.title !== undefined) patch.title = data.title;
  if (data.tags !== undefined) patch.tags = data.tags;
  if (data.assetIds !== undefined) {
    await db.delete(incidentAssets).where(eq(incidentAssets.incidentId, id));
    if (data.assetIds.length) {
      await db.insert(incidentAssets).values(
        data.assetIds.map((assetId) => ({ incidentId: id, assetId })),
      ).onConflictDoNothing();
    }
    changes.push("affected assets updated");
  }

  const [updated] = await db.update(incidents).set(patch).where(eq(incidents.id, id)).returning();
  if (!updated) throw notFound("incident");

  if (changes.length) {
    await logActivity({
      actorId: user.id,
      actorName: user.name,
      action: "incident.updated",
      entityType: "incident",
      entityId: id,
      entityKey: updated.key,
      summary: `${user.name} updated ${updated.key} — ${changes.join(", ")}`,
    });
  }
  return updated;
}

export async function deleteIncident(user: SessionUser, id: number) {
  assertPermission(user, "delete", "incident");
  const target = await getIncident(id);
  await db.delete(incidents).where(eq(incidents.id, id));
  await logActivity({
    actorId: user.id,
    actorName: user.name,
    action: "incident.deleted",
    entityType: "incident",
    entityId: id,
    entityKey: target.key,
    summary: `${user.name} deleted ${target.key} — “${target.title}”`,
  });
  return { ok: true };
}

export async function listAssignableUsers() {
  return db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.status, "ACTIVE"))
    .orderBy(users.name);
}

export async function listAssetsLite() {
  return db
    .select({ id: assets.id, key: assets.key, name: assets.name, type: assets.type })
    .from(assets)
    .orderBy(assets.name);
}

export function requirePositiveId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "BAD_ID", "Invalid record identifier.");
  return id;
}
