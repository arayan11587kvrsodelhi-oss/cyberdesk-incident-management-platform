import { createHmac } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { passwordResets, sessions, users } from "@/db/schema";
import { hashPassword, randomToken } from "@/lib/password";
import { getAuthSecret } from "@/lib/auth-secret";

const sha = (v: string) =>
  createHmac("sha256", getAuthSecret()).update(v).digest("hex");

export async function createResetToken(userId: number) {
  const token = randomToken(24);
  await db.insert(passwordResets).values({
    userId,
    tokenHash: sha(token),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  return token;
}

export async function verifyResetToken(token: string) {
  const [row] = await db
    .select({ id: passwordResets.id, userId: passwordResets.userId })
    .from(passwordResets)
    .where(
      and(
        eq(passwordResets.tokenHash, sha(token)),
        gt(passwordResets.expiresAt, new Date()),
        isNull(passwordResets.usedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Marks the token used, replaces the password, and revokes existing sessions. */
export async function consumeResetToken(token: string, newPassword: string) {
  const found = await verifyResetToken(token);
  if (!found) return null;

  await db.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.id, found.id));
  await db
    .update(users)
    .set({ passwordHash: hashPassword(newPassword), updatedAt: new Date() })
    .where(eq(users.id, found.userId));
  await db.delete(sessions).where(eq(sessions.userId, found.userId));

  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, found.userId))
    .limit(1);
  return user ?? null;
}
