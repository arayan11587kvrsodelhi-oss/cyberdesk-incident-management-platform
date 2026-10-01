import { handle } from "@/server/http";
import { getSession, requireUser } from "@/server/auth";
import { ApiError } from "@/lib/api-error";
import { createTeamMember, listTeam, updateTeamMember } from "@/server/team";
import { logActivity } from "@/server/activity";

export async function GET() {
  return handle(async () => {
    const ctx = await getSession();
    if (!ctx) throw new ApiError(401, "UNAUTHORIZED", "Please sign in to continue.");
    return { members: await listTeam(), viewerId: ctx.user.id };
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const member = await createTeamMember(user, await req.json());
    return { member };
  }, 201, req);
}

/** Deactivation shortcut: PATCH is the primary path, DELETE removes the account. */
export async function DELETE(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = (await req.json()) as { id?: number };
    if (!id) throw new ApiError(400, "BAD_ID", "Missing team member identifier.");
    const updated = await updateTeamMember(user, id, { status: "DEACTIVATED" });
    await logActivity({
      actorId: user.id,
      actorName: user.name,
      action: "user.deactivated",
      entityType: "user",
      entityId: id,
      entityKey: null,
      summary: `${user.name} deactivated a workspace account`,
    });
    return { member: updated };
  }, 200, req);
}
