import { handle } from "@/server/http";
import { getSession } from "@/server/auth";
import { ApiError } from "@/lib/api-error";
import { createTask, listTasks } from "@/server/tasks";

export async function GET(req: Request) {
  return handle(async () => {
    const ctx = await getSession();
    if (!ctx) throw new ApiError(401, "UNAUTHORIZED", "Please sign in to continue.");
    const p = new URL(req.url).searchParams;
    return listTasks({
      q: p.get("q") ?? undefined,
      status: p.get("status") ?? undefined,
      priority: p.get("priority") ?? undefined,
      assignee: p.get("assignee") ?? undefined,
      incident: p.get("incident") ?? undefined,
      sort: (p.get("sort") as "due" | "priority" | "status" | "created") ?? "due",
      page: Number(p.get("page") ?? 1) || 1,
      pageSize: Number(p.get("pageSize") ?? 10) || 10,
    });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const ctx = await getSession();
    if (!ctx) throw new ApiError(401, "UNAUTHORIZED", "Please sign in to continue.");
    const task = await createTask(ctx.user, await req.json());
    return { task };
  }, 201, req);
}
