import { handle } from "@/server/http";
import { getSession, requireUser } from "@/server/auth";
import { ApiError } from "@/lib/api-error";
import { updateTeamMember } from "@/server/team";
import { assertPermission } from "@/server/guard";
import { requirePositiveId } from "@/server/incidents";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  return handle(async () => {
    const user = await requireUser();
    assertPermission(user, "update", "user");
    const id = requirePositiveId((await params).id);
    return { member: await updateTeamMember(user, id, await req.json()) };
  }, 200, req);
}

export async function GET(_req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await getSession();
    if (!ctx) throw new ApiError(401, "UNAUTHORIZED", "Please sign in to continue.");
    const id = requirePositiveId((await params).id);
    return { id, viewer: ctx.user.id, isAdmin: ctx.user.role === "ADMIN" };
  });
}
