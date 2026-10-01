import { handle } from "@/server/http";
import { getSession } from "@/server/auth";
import { ApiError } from "@/lib/api-error";
import { getDashboardStats } from "@/server/dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const ctx = await getSession();
    if (!ctx) throw new ApiError(401, "UNAUTHORIZED", "Please sign in to continue.");
    return getDashboardStats();
  });
}
