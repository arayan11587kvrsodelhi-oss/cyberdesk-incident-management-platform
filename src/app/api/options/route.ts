import { handle } from "@/server/http";
import { getSession } from "@/server/auth";
import { ApiError } from "@/lib/api-error";
import { listAssetsLite, listAssignableUsers } from "@/server/incidents";
import { listIncidentsLite } from "@/server/alerts";

/** Dropdown payload for forms: users, assets and incidents. */
export async function GET() {
  return handle(async () => {
    const ctx = await getSession();
    if (!ctx) throw new ApiError(401, "UNAUTHORIZED", "Please sign in to continue.");
    const [users, assetRows, incidentRows] = await Promise.all([
      listAssignableUsers(),
      listAssetsLite(),
      listIncidentsLite(),
    ]);

    return {
      users,
      assets: assetRows,
      incidents: incidentRows,
      viewer: { id: ctx.user.id, role: ctx.user.role, name: ctx.user.name },
    };
  });
}
