import { ApiError } from "@/lib/api-error";
import { can, type Action, type ResourceKind } from "@/lib/permissions";
import type { SessionUser } from "@/server/auth";

/** Server-side authorization gate. Runs on every mutation regardless of UI state. */
export function assertPermission(user: SessionUser, action: Action, resource: ResourceKind) {
  if (!can(user.role, action, resource)) {
    const readable =
      user.role === "VIEWER"
        ? "You have read-only access, so this change was not applied."
        : "Your role does not permit this action.";
    throw new ApiError(403, "FORBIDDEN", readable);
  }
}

export function assertNotSelf(user: SessionUser, targetId: number, what: string) {
  if (user.id === targetId) {
    throw new ApiError(400, "INVALID_TARGET", `You cannot ${what} your own account here.`);
  }
}

export function notFound(what = "resource") {
  return new ApiError(404, "NOT_FOUND", `That ${what} no longer exists or you do not have access to it.`);
}
