import { handle } from "@/server/http";
import { getSession } from "@/server/auth";
import { ApiError } from "@/lib/api-error";
import { createAsset, listAssets } from "@/server/assets";

export async function GET(req: Request) {
  return handle(async () => {
    const ctx = await getSession();
    if (!ctx) throw new ApiError(401, "UNAUTHORIZED", "Please sign in to continue.");
    const p = new URL(req.url).searchParams;
    return listAssets({
      q: p.get("q") ?? undefined,
      type: p.get("type") ?? undefined,
      environment: p.get("environment") ?? undefined,
      status: p.get("status") ?? undefined,
      page: Number(p.get("page") ?? 1) || 1,
      pageSize: Number(p.get("pageSize") ?? 10) || 10,
    });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const ctx = await getSession();
    if (!ctx) throw new ApiError(401, "UNAUTHORIZED", "Please sign in to continue.");
    const asset = await createAsset(ctx.user, await req.json());
    return { asset };
  }, 201);
}
