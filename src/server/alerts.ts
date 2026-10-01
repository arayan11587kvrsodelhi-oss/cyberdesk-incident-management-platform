import { count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { alerts, incidents, users } from "@/db/schema";
import { alertSchema, alertUpdateSchema } from "@/validators";
import { ApiError } from "@/lib/api-error";
import { parseOrThrow } from "@/lib/api-error";
import type { SessionUser } from "@/server/auth";
import { assertPermission, notFound } from "@/server/guard";
import { logActivity } from "@/server/activity";
import { nextKey } from "@/server/incidents";

export type AlertFilters = {
  q?: string;
  severity?: string;
  status?: string;
  source?: string;
  page?: number;
  pageSize?: number;
};

export async function listAlerts(f: AlertFilters) {
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, f.pageSize ?? 10));
  const conditions = [];

  if (f.severity && f.severity !== "ALL") conditions.push(sql`${alerts.severity} = ${f.severity}::severity`);
  if (f.status && f.status !== "ALL") conditions.push(sql`${alerts.status} = ${f.status}::alert_status`);
  if (f.source && f.source !== "ALL") conditions.push(sql`${alerts.source} = ${f.source}::alert_source`);
  if (f.q && f.q.trim()) {
    const like = `%${f.q.trim().toLowerCase()}%`;
    conditions.push(
      sql`(lower(${alerts.title}) like ${like} or lower(${alerts.key}) like ${like} or lower(${alerts.detail}) like ${like})`,
    );
  }
  const where = conditions.length ? sql.join(conditions, sql` and `) : undefined;

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: alerts.id,
        key: alerts.key,
        title: alerts.title,
        source: alerts.source,
        severity: alerts.severity,
        status: alerts.status,
        detail: alerts.detail,
        detectedAt: alerts.detectedAt,
        updatedAt: alerts.updatedAt,
        incidentId: alerts.incidentId,
        incidentKey: incidents.key,
        incidentTitle: incidents.title,
      })
      .from(alerts)
      .leftJoin(incidents, eq(alerts.incidentId, incidents.id))
      .where(where)
      .orderBy(desc(alerts.detectedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ n: count() }).from(alerts).where(where),
  ]);

  return { rows, total: totalRow[0]?.n ?? 0, page, pageSize };
}

export async function getAlert(id: number) {
  const [row] = await db.select().from(alerts).where(eq(alerts.id, id)).limit(1);
  if (!row) throw notFound("alert");
  return row;
}

export async function createAlert(user: SessionUser, input: unknown) {
  assertPermission(user, "create", "alert");
  const data = parseOrThrow(alertSchema, input);
  const key = await nextKey("ALT", alerts, alerts.key);
  const [created] = await db
    .insert(alerts)
    .values({
      key,
      title: data.title,
      detail: data.detail,
      source: data.source,
      severity: data.severity,
      status: data.status,
      detectedAt: data.detectedAt ?? new Date(),
      incidentId: data.incidentId ?? null,
    })
    .returning();

  await logActivity({
    actorId: user.id,
    actorName: user.name,
    action: "alert.created",
    entityType: "alert",
    entityId: created.id,
    entityKey: created.key,
    summary: `${user.name} recorded ${created.key} — “${created.title}”`,
  });
  return created;
}

export async function updateAlert(user: SessionUser, id: number, input: unknown) {
  assertPermission(user, "update", "alert");
  const data = parseOrThrow(alertUpdateSchema, input);
  const before = await getAlert(id);

  const patch: Partial<typeof alerts.$inferInsert> = { updatedAt: new Date() };
  const changes: string[] = [];
  if (data.title !== undefined) patch.title = data.title;
  if (data.detail !== undefined) patch.detail = data.detail;
  if (data.source !== undefined) patch.source = data.source;
  if (data.severity !== undefined && data.severity !== before.severity) {
    patch.severity = data.severity;
    changes.push(`severity → ${data.severity.toLowerCase()}`);
  }
  if (data.status !== undefined && data.status !== before.status) {
    patch.status = data.status;
    changes.push(`status → ${data.status.toLowerCase()}`);
  }
  if (data.detectedAt !== undefined) patch.detectedAt = data.detectedAt;
  if (data.incidentId !== undefined && data.incidentId !== before.incidentId) {
    const target = data.incidentId;
    if (target) {
      const [inc] = await db.select({ id: incidents.id }).from(incidents).where(eq(incidents.id, target)).limit(1);
      if (!inc) throw new ApiError(422, "INVALID_INCIDENT", "That incident no longer exists. Link to another.");
      patch.incidentId = target;
    } else {
      patch.incidentId = null;
    }
  }

  const [updated] = await db.update(alerts).set(patch).where(eq(alerts.id, id)).returning();
  if (!updated) throw notFound("alert");

  if (changes.length || data.incidentId !== undefined) {
    await logActivity({
      actorId: user.id,
      actorName: user.name,
      action: "alert.updated",
      entityType: "alert",
      entityId: id,
      entityKey: updated.key,
      summary: `${user.name} updated ${updated.key}${changes.length ? ` — ${changes.join(", ")}` : ""}`,
    });
  }
  return updated;
}

export async function deleteAlert(user: SessionUser, id: number) {
  assertPermission(user, "delete", "alert");
  const target = await getAlert(id);
  await db.delete(alerts).where(eq(alerts.id, id));
  await logActivity({
    actorId: user.id,
    actorName: user.name,
    action: "alert.deleted",
    entityType: "alert",
    entityId: id,
    entityKey: target.key,
    summary: `${user.name} removed ${target.key} — “${target.title}”`,
  });
  return { ok: true };
}

export async function listIncidentsLite() {
  return db
    .select({ id: incidents.id, key: incidents.key, title: incidents.title })
    .from(incidents)
    .orderBy(desc(incidents.createdAt))
    .limit(60);
}

export async function listTeamLite() {
  return db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.status, "ACTIVE"))
    .orderBy(users.name);
}
