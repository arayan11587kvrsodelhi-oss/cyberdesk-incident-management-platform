import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { handle } from "@/server/http";
import { getSession } from "@/server/auth";
import { ApiError } from "@/lib/api-error";

/** Signed-in account summary for the settings screen. */
export async function GET() {
  return handle(async () => {
    const ctx = await getSession();
    if (!ctx) throw new ApiError(401, "UNAUTHORIZED", "Please sign in to continue.");
    const [row] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        title: users.title,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);
    if (!row) throw new ApiError(404, "NOT_FOUND", "Account not found.");
    return { viewer: row };
  });
}
