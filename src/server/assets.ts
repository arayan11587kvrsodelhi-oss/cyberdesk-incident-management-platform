import { count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { assets, users } from "@/db/schema";
import { assetSchema, assetUpdateSchema } from "@/validators";
import { parseOrThrow } from "@/lib/api-error";
import type { SessionUser } from "@/server/auth";
import { assertPermission, notFound } from "@/server/guard";
import { logActivity } from "@/server/activity";
import { nextKey } from "@/server/incidents";

export type AssetFilters = {
  q?: string;
  type?: string;
  environment?: string;
  status?: string;
  page?: number;
  pageSize?: number;
};

export async function listAssets(f: AssetFilters) {
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, f.pageSize ?? 10));
  const conditions = [];

  if (f.type && f.type !== "ALL") conditions.push(sql`${assets.type} = ${f.type}::asset_type`);
  if (f.environment && f.environment !== "ALL") conditions.push(sql`${assets.environment} = ${f.environment}::asset_env`);
  if (f.status && f.status !== "ALL") conditions.push(sql`${assets.status} = ${f.status}::asset_status`);
  if (f.q && f.q.trim()) {
    const like = `%${f.q.trim().toLowerCase()}%`;
    conditions.push(
      sql`(lower(${assets.name}) like ${like} or lower(${assets.key}) like ${like} or lower(coalesce(${assets.ipAddress}, '')) like ${like})`,
    );
  }
  const where = conditions.length ? sql.join(conditions, sql` and `) : undefined;

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: assets.id,
        key: assets.key,
        name: assets.name,
        type: assets.type,
        ipAddress: assets.ipAddress,
        environment: assets.environment,
        status: assets.status,
        lastSeen: assets.lastSeen,
        createdAt: assets.createdAt,
        ownerId: assets.ownerId,
        ownerName: users.name,
      })
      .from(assets)
      .leftJoin(users, eq(assets.ownerId, users.id))
      .where(where)
      .orderBy(desc(assets.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ n: count() }).from(assets).where(where),
  ]);

  return { rows, total: totalRow[0]?.n ?? 0, page, pageSize };
}

export async function getAsset(id: number) {
  const [row] = await db
    .select({
      id: assets.id,
      key: assets.key,
      name: assets.name,
      type: assets.type,
      ipAddress: assets.ipAddress,
      environment: assets.environment,
      status: assets.status,
      lastSeen: assets.lastSeen,
      createdAt: assets.createdAt,
      updatedAt: assets.updatedAt,
      ownerId: assets.ownerId,
      ownerName: users.name,
    })
    .from(assets)
    .leftJoin(users, eq(assets.ownerId, users.id))
    .where(eq(assets.id, id))
    .limit(1);
  if (!row) throw notFound("asset");
  return row;
}

export async function createAsset(user: SessionUser, input: unknown) {
  assertPermission(user, "create", "asset");
  const data = parseOrThrow(assetSchema, input);
  const key = await nextKey("AST", assets);
  const [created] = await db
    .insert(assets)
    .values({
      key,
      name: data.name,
      type: data.type,
      ipAddress: data.ipAddress || null,
      environment: data.environment,
      status: data.status,
      ownerId: data.ownerId ?? null,
      lastSeen: data.lastSeen ?? new Date(),
    })
    .returning();

  await logActivity({
    actorId: user.id,
    actorName: user.name,
    action: "asset.created",
    entityType: "asset",
    entityId: created.id,
    entityKey: created.key,
    summary: `${user.name} added asset ${created.key} — ${created.name}`,
  });
  return created;
}

export async function updateAsset(user: SessionUser, id: number, input: unknown) {
  assertPermission(user, "update", "asset");
  const data = parseOrThrow(assetUpdateSchema, input);
  const before = await getAsset(id);

  const patch: Partial<typeof assets.$inferInsert> = { updatedAt: new Date() };
  const changes: string[] = [];
  if (data.name !== undefined) patch.name = data.name;
  if (data.type !== undefined) patch.type = data.type;
  if (data.ipAddress !== undefined) patch.ipAddress = data.ipAddress || null;
  if (data.environment !== undefined) patch.environment = data.environment;
  if (data.status !== undefined && data.status !== before.status) {
    patch.status = data.status;
    changes.push(`status → ${data.status.toLowerCase()}`);
  }
  if (data.ownerId !== undefined) patch.ownerId = data.ownerId ?? null;
  if (data.lastSeen !== undefined) patch.lastSeen = data.lastSeen;

  const [updated] = await db.update(assets).set(patch).where(eq(assets.id, id)).returning();
  if (!updated) throw notFound("asset");

  if (changes.length) {
    await logActivity({
      actorId: user.id,
      actorName: user.name,
      action: "asset.updated",
      entityType: "asset",
      entityId: id,
      entityKey: updated.key,
      summary: `${user.name} updated ${updated.key} — ${changes.join(", ")}`,
    });
  }
  return updated;
}

export async function deleteAsset(user: SessionUser, id: number) {
  assertPermission(user, "delete", "asset");
  const target = await getAsset(id);
  await db.delete(assets).where(eq(assets.id, id));
  await logActivity({
    actorId: user.id,
    actorName: user.name,
    action: "asset.deleted",
    entityType: "asset",
    entityId: id,
    entityKey: target.key,
    summary: `${user.name} removed asset ${target.key} — ${target.name}`,
  });
  return { ok: true };
}
