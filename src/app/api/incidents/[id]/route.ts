import { handle } from "@/server/http";
import { getSession } from "@/server/auth";
import { ApiError } from "@/lib/api-error";
import {
  deleteIncident,
  getIncident,
  incidentAssetIds,
  requirePositiveId,
  updateIncident,
} from "@/server/incidents";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await getSession();
    if (!ctx) throw new ApiError(401, "UNAUTHORIZED", "Please sign in to continue.");
    const id = requirePositiveId((await params).id);
    const incident = await getIncident(id);
    const assetIds = await incidentAssetIds(id);
    return { incident, assetIds };
  });
}

export async function PATCH(req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await getSession();
    if (!ctx) throw new ApiError(401, "UNAUTHORIZED", "Please sign in to continue.");
    const id = requirePositiveId((await params).id);
    const incident = await updateIncident(ctx.user, id, await req.json());
    return { incident };
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await getSession();
    if (!ctx) throw new ApiError(401, "UNAUTHORIZED", "Please sign in to continue.");
    const id = requirePositiveId((await params).id);
    return deleteIncident(ctx.user, id);
  });
}
