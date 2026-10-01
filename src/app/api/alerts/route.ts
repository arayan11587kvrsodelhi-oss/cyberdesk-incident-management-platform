import { handle } from "@/server/http";
import { getSession } from "@/server/auth";
import { ApiError } from "@/lib/api-error";
import { createAlert, listAlerts } from "@/server/alerts";

export async function GET(req: Request) {
  return handle(async () => {
    const ctx = await getSession();
    if (!ctx) throw new ApiError(401, "UNAUTHORIZED", "Please sign in to continue.");
    const p = new URL(req.url).searchParams;
    return listAlerts({
      q: p.get("q") ?? undefined,
      severity: p.get("severity") ?? undefined,
      status: p.get("status") ?? undefined,
      source: p.get("source") ?? undefined,
      page: Number(p.get("page") ?? 1) || 1,
      pageSize: Number(p.get("pageSize") ?? 10) || 10,
    });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const ctx = await getSession();
    if (!ctx) throw new ApiError(401, "UNAUTHORIZED", "Please sign in to continue.");
    const alert = await createAlert(ctx.user, await req.json());
    return { alert };
  }, 201);
}
