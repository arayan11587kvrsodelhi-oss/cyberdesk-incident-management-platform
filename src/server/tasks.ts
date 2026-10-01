import { count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { incidents, tasks, users } from "@/db/schema";
import { taskSchema, taskUpdateSchema } from "@/validators";
import { parseOrThrow } from "@/lib/api-error";
import type { SessionUser } from "@/server/auth";
import { assertPermission, notFound } from "@/server/guard";
import { logActivity } from "@/server/activity";
import { nextKey } from "@/server/incidents";

export type TaskFilters = {
  q?: string;
  status?: string;
  priority?: string;
  assignee?: string;
  incident?: string;
  sort?: "due" | "priority" | "status" | "created";
  page?: number;
  pageSize?: number;
};

const PRIORITY_ORDER = sql`case ${tasks.priority} when 'CRITICAL' then 0 when 'HIGH' then 1 when 'MEDIUM' then 2 else 3 end`;
const STATUS_ORDER = sql`case ${tasks.status} when 'TODO' then 0 when 'IN_PROGRESS' then 1 when 'BLOCKED' then 2 else 3 end`;

export async function listTasks(f: TaskFilters) {
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, f.pageSize ?? 10));
  const conditions = [];

  if (f.status && f.status !== "ALL") conditions.push(sql`${tasks.status} = ${f.status}::task_status`);
  if (f.priority && f.priority !== "ALL") conditions.push(sql`${tasks.priority} = ${f.priority}::task_priority`);
  if (f.assignee && f.assignee !== "ALL") {
    conditions.push(
      f.assignee === "NONE"
        ? sql`${tasks.assigneeId} is null`
        : sql`${tasks.assigneeId} = ${Number(f.assignee)}`,
    );
  }
  if (f.incident && f.incident !== "ALL") conditions.push(eq(tasks.incidentId, Number(f.incident)));
  if (f.q && f.q.trim()) {
    const like = `%${f.q.trim().toLowerCase()}%`;
    conditions.push(
      sql`(lower(${tasks.title}) like ${like} or lower(${tasks.description}) like ${like} or lower(${tasks.key}) like ${like})`,
    );
  }
  const where = conditions.length ? sql.join(conditions, sql` and `) : undefined;

  const orderBy =
    f.sort === "priority"
      ? [PRIORITY_ORDER, desc(tasks.dueDate)]
      : f.sort === "status"
        ? [STATUS_ORDER, PRIORITY_ORDER]
        : f.sort === "created"
          ? [desc(tasks.createdAt)]
          : [sql`${tasks.dueDate} asc nulls last`, PRIORITY_ORDER];

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: tasks.id,
        key: tasks.key,
        title: tasks.title,
        description: tasks.description,
        priority: tasks.priority,
        status: tasks.status,
        dueDate: tasks.dueDate,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        incidentId: tasks.incidentId,
        incidentKey: incidents.key,
        incidentTitle: incidents.title,
        incidentSeverity: incidents.severity,
        assigneeId: tasks.assigneeId,
        assigneeName: users.name,
      })
      .from(tasks)
      .innerJoin(incidents, eq(tasks.incidentId, incidents.id))
      .leftJoin(users, eq(tasks.assigneeId, users.id))
      .where(where)
      .orderBy(...orderBy)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ n: count() }).from(tasks).where(where),
  ]);

  return { rows, total: totalRow[0]?.n ?? 0, page, pageSize };
}

export async function getTask(id: number) {
  const [row] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  if (!row) throw notFound("task");
  return row;
}

export async function createTask(user: SessionUser, input: unknown) {
  assertPermission(user, "create", "task");
  const data = parseOrThrow(taskSchema, input);

  const [incident] = await db
    .select({ key: incidents.key })
    .from(incidents)
    .where(eq(incidents.id, data.incidentId))
    .limit(1);
  if (!incident) throw notFound("incident");

  const key = await nextKey("TSK", tasks);
  const [created] = await db
    .insert(tasks)
    .values({
      key,
      title: data.title,
      description: data.description,
      incidentId: data.incidentId,
      assigneeId: data.assigneeId ?? null,
      priority: data.priority,
      status: data.status,
      dueDate: data.dueDate || null,
    })
    .returning();

  await logActivity({
    actorId: user.id,
    actorName: user.name,
    action: "task.created",
    entityType: "task",
    entityId: created.id,
    entityKey: created.key,
    summary: `${user.name} created task ${created.key} — “${created.title}”`,
  });
  return created;
}

export async function updateTask(user: SessionUser, id: number, input: unknown) {
  assertPermission(user, "update", "task");
  const data = parseOrThrow(taskUpdateSchema, input);
  const before = await getTask(id);

  const patch: Partial<typeof tasks.$inferInsert> = { updatedAt: new Date() };
  const changes: string[] = [];
  if (data.title !== undefined) patch.title = data.title;
  if (data.description !== undefined) patch.description = data.description;
  if (data.incidentId !== undefined) patch.incidentId = data.incidentId;
  if (data.assigneeId !== undefined) patch.assigneeId = data.assigneeId ?? null;
  if (data.priority !== undefined && data.priority !== before.priority) {
    patch.priority = data.priority;
    changes.push(`priority → ${data.priority.toLowerCase()}`);
  }
  if (data.status !== undefined && data.status !== before.status) {
    patch.status = data.status;
    changes.push(`status → ${data.status.replace("_", " ").toLowerCase()}`);
    if (data.status === "DONE") changes.push("completed");
  }
  if (data.dueDate !== undefined) patch.dueDate = data.dueDate || null;

  const [updated] = await db.update(tasks).set(patch).where(eq(tasks.id, id)).returning();
  if (!updated) throw notFound("task");

  if (changes.length) {
    await logActivity({
      actorId: user.id,
      actorName: user.name,
      action: data.status === "DONE" ? "task.completed" : "task.updated",
      entityType: "task",
      entityId: id,
      entityKey: updated.key,
      summary: `${user.name} updated ${updated.key} — ${changes.join(", ")}`,
    });
  }
  return updated;
}

export async function deleteTask(user: SessionUser, id: number) {
  assertPermission(user, "delete", "task");
  const target = await getTask(id);
  await db.delete(tasks).where(eq(tasks.id, id));
  await logActivity({
    actorId: user.id,
    actorName: user.name,
    action: "task.deleted",
    entityType: "task",
    entityId: id,
    entityKey: target.key,
    summary: `${user.name} deleted task ${target.key} — “${target.title}”`,
  });
  return { ok: true };
}
