import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs } from "@/db/schema";

export async function listActivity(limitParam?: string) {
  const limit = Math.min(100, Number(limitParam ?? 25) || 25);
  return db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)).limit(limit);
}

/** Activity entries that belong to one of the given entities. */
export async function activityForEntities(entityType: string, ids: number[]) {
  if (!ids.length) return [];
  const rows = await db
    .select()
    .from(activityLogs)
    .where(inArray(activityLogs.entityId, ids))
    .orderBy(desc(activityLogs.createdAt))
    .limit(200);
  return rows.filter((r) => r.entityType === entityType && ids.includes(r.entityId ?? -1));
}

export async function activityForIncident(incidentId: number) {
  const rows = await db
    .select()
    .from(activityLogs)
    .orderBy(desc(activityLogs.createdAt))
    .limit(300);
  return rows.filter(
    (r) =>
      (r.entityType === "incident" && r.entityId === incidentId) ||
      (r.entityKey && r.entityKey.includes("-") && r.entityType !== "incident" && r.entityId === incidentId),
  );
}

export async function activityByEntityKey(keys: string[]) {
  if (!keys.length) return [];
  const rows = await db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)).limit(400);
  return rows.filter((r) => r.entityKey && keys.includes(r.entityKey));
}

export async function noteActivity(noteIds: number[]) {
  if (!noteIds.length) return [];
  const rows = await db
    .select()
    .from(activityLogs)
    .where(eq(activityLogs.entityType, "note"))
    .orderBy(desc(activityLogs.createdAt))
    .limit(300);
  return rows.filter((r) => noteIds.includes(r.entityId ?? -1));
}
