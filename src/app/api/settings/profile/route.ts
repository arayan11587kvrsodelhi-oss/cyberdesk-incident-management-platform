import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { handle } from "@/server/http";
import { requireUser, startSession, requestMeta, assertSameOrigin } from "@/server/auth";
import { changePasswordSchema, profileSchema } from "@/validators";
import { verifyPassword, hashPassword } from "@/lib/password";
import { ApiError } from "@/lib/api-error";
import { logActivity } from "@/server/activity";

export async function PATCH(req: Request) {
  return handle(async () => {
    await assertSameOrigin();
    const user = await requireUser();
    const input = profileSchema.parse(await req.json());

    const [updated] = await db
      .update(users)
      .set({ name: input.name, updatedAt: new Date() })
      .where(eq(users.id, user.id))
      .returning({ id: users.id, name: users.name, email: users.email, role: users.role });

    await logActivity({
      actorId: user.id,
      actorName: updated.name,
      action: "profile.updated",
      entityType: "user",
      entityId: user.id,
      entityKey: null,
      summary: `${updated.name} updated their profile`,
    });

    return { user: updated };
  });
}

export async function PUT(req: Request) {
  // Change password (settings → security).
  return handle(async () => {
    await assertSameOrigin();
    const user = await requireUser();
    const input = changePasswordSchema.parse(await req.json());

    const [row] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    if (!row) throw new ApiError(404, "NOT_FOUND", "Account not found.");
    if (!verifyPassword(input.currentPassword, row.passwordHash)) {
      throw new ApiError(400, "BAD_PASSWORD", "Your current password is not correct.", {
        currentPassword: "That is not your current password",
      });
    }

    await db
      .update(users)
      .set({ passwordHash: hashPassword(input.newPassword), updatedAt: new Date() })
      .where(eq(users.id, user.id));

    // Keep the current session alive and revoke every other active session.
    const meta = await requestMeta();
    const newSessionId = await startSession({ id: user.id }, meta.ua, meta.ip);
    await db.delete(sessions).where(and(eq(sessions.userId, user.id), ne(sessions.id, newSessionId)));

    await logActivity({
      actorId: user.id,
      actorName: user.name,
      action: "auth.password_changed",
      entityType: "user",
      entityId: user.id,
      entityKey: null,
      summary: `${user.name} changed their password`,
    });

    return { ok: true, message: "Password updated." };
  });
}
