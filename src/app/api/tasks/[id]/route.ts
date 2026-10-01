import { handle } from "@/server/http";
import { getSession } from "@/server/auth";
import { ApiError } from "@/lib/api-error";
import { deleteTask, getTask, updateTask } from "@/server/tasks";
import { requirePositiveId } from "@/server/incidents";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await getSession();
    if (!ctx) throw new ApiError(401, "UNAUTHORIZED", "Please sign in to continue.");
    return { task: await getTask(requirePositiveId((await params).id)) };
  });
}

export async function PATCH(req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await getSession();
    if (!ctx) throw new ApiError(401, "UNAUTHORIZED", "Please sign in to continue.");
    const task = await updateTask(ctx.user, requirePositiveId((await params).id), await req.json());
    return { task };
  }, 200, req);
}

export async function DELETE(req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await getSession();
    if (!ctx) throw new ApiError(401, "UNAUTHORIZED", "Please sign in to continue.");
    return deleteTask(ctx.user, requirePositiveId((await params).id));
  }, 200, req);
}
