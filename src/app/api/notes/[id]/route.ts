import { handle } from "@/server/http";
import { getSession } from "@/server/auth";
import { ApiError } from "@/lib/api-error";
import { deleteNote, getNote, updateNote } from "@/server/notes";
import { requirePositiveId } from "@/server/incidents";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await getSession();
    if (!ctx) throw new ApiError(401, "UNAUTHORIZED", "Please sign in to continue.");
    return { note: await getNote(requirePositiveId((await params).id)) };
  });
}

export async function PATCH(req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await getSession();
    if (!ctx) throw new ApiError(401, "UNAUTHORIZED", "Please sign in to continue.");
    const note = await updateNote(ctx.user, requirePositiveId((await params).id), await req.json());
    return { note };
  }, 200, req);
}

export async function DELETE(req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await getSession();
    if (!ctx) throw new ApiError(401, "UNAUTHORIZED", "Please sign in to continue.");
    return deleteNote(ctx.user, requirePositiveId((await params).id));
  }, 200, req);
}
