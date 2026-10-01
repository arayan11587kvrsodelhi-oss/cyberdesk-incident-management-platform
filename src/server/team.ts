import { count, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { teamCreateSchema, teamUpdateSchema } from "@/validators";
import { parseOrThrow, ApiError } from "@/lib/api-error";
import { hashPassword } from "@/lib/password";
import type { SessionUser } from "@/server/auth";
import { assertPermission, notFound } from "@/server/guard";
import { logActivity } from "@/server/activity";

export async function listTeam() {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      status: users.status,
      title: users.title,
      createdAt: users.createdAt,
      sessionCount: count(sessions.id),
    })
    .from(users)
    .leftJoin(sessions, eq(sessions.userId, users.id))
    .groupBy(users.id)
    .orderBy(users.name);
  return rows;
}

export async function createTeamMember(user: SessionUser, input: unknown) {
  assertPermission(user, "create", "user");
  const data = parseOrThrow(teamCreateSchema, input);

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, data.email)).limit(1);
  if (existing.length) {
    throw new ApiError(409, "EMAIL_TAKEN", "An account with that email already exists.", {
      email: "That email is already registered",
    });
  }

  const [created] = await db
    .insert(users)
    .values({
      name: data.name,
      email: data.email,
      passwordHash: hashPassword(data.password),
      role: data.role,
      title: data.title || null,
      status: "ACTIVE",
    })
    .returning({ id: users.id, name: users.name, email: users.email, role: users.role });

  await logActivity({
    actorId: user.id,
    actorName: user.name,
    action: "user.created",
    entityType: "user",
    entityId: created.id,
    entityKey: null,
    summary: `${user.name} added ${created.name} to the workspace as ${created.role}`,
  });
  return created;
}

export async function updateTeamMember(user: SessionUser, id: number, input: unknown) {
  assertPermission(user, "update", "user");
  const data = parseOrThrow(teamUpdateSchema, input);
  if (id === user.id) {
    throw new ApiError(400, "SELF_CHANGE", "You cannot change your own role or status here.");
  }

  const [before] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!before) throw notFound("team member");

  const patch: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
  const changes: string[] = [];
  if (data.role !== undefined && data.role !== before.role) {
    patch.role = data.role;
    changes.push(`role → ${data.role}`);
  }
  if (data.status !== undefined && data.status !== before.status) {
    patch.status = data.status;
    changes.push(data.status === "ACTIVE" ? "reinstated" : "deactivated");
  }
  if (data.name !== undefined) patch.name = data.name;
  if (data.title !== undefined) patch.title = data.title || null;

  const [updated] = await db.update(users).set(patch).where(eq(users.id, id)).returning({
    id: users.id,
    name: users.name,
    email: users.email,
    role: users.role,
    status: users.status,
  });

  if (changes.includes("deactivated")) {
    await db.delete(sessions).where(eq(sessions.userId, id));
  }

  if (changes.length) {
    await logActivity({
      actorId: user.id,
      actorName: user.name,
      action: "user.updated",
      entityType: "user",
      entityId: id,
      entityKey: null,
      summary: `${user.name} updated ${before.name} — ${changes.join(", ")}`,
    });
  }
  return updated;
}

export async function deactivateTeamMember(user: SessionUser, id: number) {
  return updateTeamMember(user, id, { status: "DEACTIVATED" });
}

export async function listTeamExcluding(id: number) {
  return db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, status: users.status })
    .from(users)
    .where(ne(users.id, id))
    .orderBy(desc(users.createdAt));
}
