import { desc } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs } from "@/db/schema";
import { handle } from "@/server/http";
import { getSession } from "@/server/auth";
import { ApiError } from "@/lib/api-error";

export async function GET(req: Request) {
  return handle(async () => {
    const ctx = await getSession();
    if (!ctx) throw new ApiError(401, "UNAUTHORIZED", "Please sign in to continue.");
    const limit = Math.min(100, Number(new URL(req.url).searchParams.get("limit") ?? 30) || 30);
    const rows = await db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)).limit(limit);
    return { rows };
  });
}
