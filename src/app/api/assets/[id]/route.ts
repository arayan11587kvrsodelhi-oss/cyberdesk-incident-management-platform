import { handle } from "@/server/http";
import { getSession } from "@/server/auth";
import { ApiError } from "@/lib/api-error";
import { deleteAsset, getAsset, updateAsset } from "@/server/assets";
import { requirePositiveId } from "@/server/incidents";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await getSession();
    if (!ctx) throw new ApiError(401, "UNAUTHORIZED", "Please sign in to continue.");
    return { asset: await getAsset(requirePositiveId((await params).id)) };
  });
}

export async function PATCH(req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await getSession();
    if (!ctx) throw new ApiError(401, "UNAUTHORIZED", "Please sign in to continue.");
    const asset = await updateAsset(ctx.user, requirePositiveId((await params).id), await req.json());
    return { asset };
  }, 200, req);
}

export async function DELETE(req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await getSession();
    if (!ctx) throw new ApiError(401, "UNAUTHORIZED", "Please sign in to continue.");
    return deleteAsset(ctx.user, requirePositiveId((await params).id));
  }, 200, req);
}
