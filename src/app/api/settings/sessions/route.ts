import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { handle } from "@/server/http";
import { getSession } from "@/server/auth";
import { ApiError } from "@/lib/api-error";

/** Active sessions for the signed-in account. Only hashed tokens exist server-side. */
export async function GET() {
  return handle(async () => {
    const ctx = await getSession();
    if (!ctx) throw new ApiError(401, "UNAUTHORIZED", "Please sign in to continue.");

    const rows = await db
      .select({
        id: sessions.id,
        userAgent: sessions.userAgent,
        ip: sessions.ip,
        createdAt: sessions.createdAt,
        lastSeenAt: sessions.lastSeenAt,
      })
      .from(sessions)
      .where(eq(sessions.userId, ctx.user.id))
      .orderBy(desc(sessions.lastSeenAt))
      .limit(10);

    return {
      sessions: rows.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
        lastSeenAt: s.lastSeenAt.toISOString(),
        current: s.id === ctx.sessionId,
      })),
    };
  });
}
