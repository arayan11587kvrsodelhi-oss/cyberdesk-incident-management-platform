import { count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { incidents, investigationNotes, users } from "@/db/schema";
import { noteSchema, noteUpdateSchema } from "@/validators";
import { parseOrThrow } from "@/lib/api-error";
import type { SessionUser } from "@/server/auth";
import { assertPermission, notFound } from "@/server/guard";
import { logActivity } from "@/server/activity";

export type NoteFilters = { q?: string; incident?: string; author?: string; page?: number; pageSize?: number };

export async function listNotes(f: NoteFilters) {
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, f.pageSize ?? 10));
  const conditions = [];

  if (f.incident && f.incident !== "ALL") conditions.push(eq(investigationNotes.incidentId, Number(f.incident)));
  if (f.author && f.author !== "ALL") conditions.push(eq(investigationNotes.authorId, Number(f.author)));
  if (f.q && f.q.trim()) {
    const like = `%${f.q.trim().toLowerCase()}%`;
    conditions.push(
      sql`(lower(${investigationNotes.title}) like ${like} or lower(${investigationNotes.body}) like ${like})`,
    );
  }
  const where = conditions.length ? sql.join(conditions, sql` and `) : undefined;

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: investigationNotes.id,
        title: investigationNotes.title,
        body: investigationNotes.body,
        createdAt: investigationNotes.createdAt,
        updatedAt: investigationNotes.updatedAt,
        incidentId: investigationNotes.incidentId,
        incidentKey: incidents.key,
        incidentTitle: incidents.title,
        authorId: investigationNotes.authorId,
        authorName: users.name,
      })
      .from(investigationNotes)
      .innerJoin(incidents, eq(investigationNotes.incidentId, incidents.id))
      .innerJoin(users, eq(investigationNotes.authorId, users.id))
      .where(where)
      .orderBy(desc(investigationNotes.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ n: count() }).from(investigationNotes).where(where),
  ]);

  return { rows, total: totalRow[0]?.n ?? 0, page, pageSize };
}

export async function getNote(id: number) {
  const [row] = await db
    .select({
      id: investigationNotes.id,
      title: investigationNotes.title,
      body: investigationNotes.body,
      incidentId: investigationNotes.incidentId,
      authorId: investigationNotes.authorId,
      createdAt: investigationNotes.createdAt,
      updatedAt: investigationNotes.updatedAt,
    })
    .from(investigationNotes)
    .where(eq(investigationNotes.id, id))
    .limit(1);
  if (!row) throw notFound("investigation note");
  return row;
}

export async function createNote(user: SessionUser, input: unknown) {
  assertPermission(user, "create", "note");
  const data = parseOrThrow(noteSchema, input);

  const [incident] = await db
    .select({ key: incidents.key, title: incidents.title })
    .from(incidents)
    .where(eq(incidents.id, data.incidentId))
    .limit(1);
  if (!incident) throw notFound("incident");

  const [created] = await db
    .insert(investigationNotes)
    .values({ title: data.title, body: data.body, incidentId: data.incidentId, authorId: user.id })
    .returning();

  await logActivity({
    actorId: user.id,
    actorName: user.name,
    action: "note.created",
    entityType: "note",
    entityId: created.id,
    entityKey: incident.key,
    summary: `${user.name} added an investigation note to ${incident.key} — “${created.title}”`,
  });
  return created;
}

export async function updateNote(user: SessionUser, id: number, input: unknown) {
  assertPermission(user, "update", "note");
  const data = parseOrThrow(noteUpdateSchema, input);
  const before = await getNote(id);

  const patch: Partial<typeof investigationNotes.$inferInsert> = { updatedAt: new Date() };
  if (data.title !== undefined) patch.title = data.title;
  if (data.body !== undefined) patch.body = data.body;

  const [updated] = await db
    .update(investigationNotes)
    .set(patch)
    .where(eq(investigationNotes.id, id))
    .returning();
  if (!updated) throw notFound("investigation note");

  await logActivity({
    actorId: user.id,
    actorName: user.name,
    action: "note.updated",
    entityType: "note",
    entityId: id,
    entityKey: null,
    summary: `${user.name} revised the note “${before.title}”`,
  });
  return updated;
}

export async function deleteNote(user: SessionUser, id: number) {
  assertPermission(user, "delete", "note");
  const target = await getNote(id);
  await db.delete(investigationNotes).where(eq(investigationNotes.id, id));
  await logActivity({
    actorId: user.id,
    actorName: user.name,
    action: "note.deleted",
    entityType: "note",
    entityId: id,
    entityKey: null,
    summary: `${user.name} deleted the note “${target.title}”`,
  });
  return { ok: true };
}
