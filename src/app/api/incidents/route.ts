import { handle, json } from "@/server/http";
import { getSession } from "@/server/auth";
import { ApiError } from "@/lib/api-error";
import { createIncident, listIncidents } from "@/server/incidents";

export async function GET(req: Request) {
  return handle(async () => {
    const ctx = await getSession();
    if (!ctx) throw new ApiError(401, "UNAUTHORIZED", "Please sign in to continue.");
    const url = new URL(req.url);
    const p = url.searchParams;
    return listIncidents({
      q: p.get("q") ?? undefined,
      severity: p.get("severity") ?? undefined,
      status: p.get("status") ?? undefined,
      assignee: p.get("assignee") ?? undefined,
      sort: (p.get("sort") as "created" | "updated" | "severity") ?? "updated",
      page: Number(p.get("page") ?? 1) || 1,
      pageSize: Number(p.get("pageSize") ?? 10) || 10,
    });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const ctx = await getSession();
    if (!ctx) throw new ApiError(401, "UNAUTHORIZED", "Please sign in to continue.");
    const created = await createIncident(ctx.user, await req.json());
    return { incident: created };
  }, 201);
}
