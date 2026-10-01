export type Role = "ADMIN" | "ANALYST" | "VIEWER";
export type ResourceKind = "incident" | "alert" | "asset" | "note" | "task" | "user";
export type Action = "create" | "update" | "delete";

/**
 * Single source of truth for role capability.
 * Used by the UI to hide controls AND enforced again on every server mutation,
 * so hiding a button is never the only protection.
 */
const MATRIX: Record<Role, Record<ResourceKind, { create: boolean; update: boolean; delete: boolean }>> = {
  ADMIN: {
    incident: { create: true, update: true, delete: true },
    alert: { create: true, update: true, delete: true },
    asset: { create: true, update: true, delete: true },
    note: { create: true, update: true, delete: true },
    task: { create: true, update: true, delete: true },
    user: { create: true, update: true, delete: true },
  },
  ANALYST: {
    incident: { create: true, update: true, delete: false },
    alert: { create: true, update: true, delete: true },
    asset: { create: true, update: true, delete: false },
    note: { create: true, update: true, delete: true },
    task: { create: true, update: true, delete: true },
    user: { create: false, update: false, delete: false },
  },
  VIEWER: {
    incident: { create: false, update: false, delete: false },
    alert: { create: false, update: false, delete: false },
    asset: { create: false, update: false, delete: false },
    note: { create: false, update: false, delete: false },
    task: { create: false, update: false, delete: false },
    user: { create: false, update: false, delete: false },
  },
};

export function can(role: Role, action: Action, resource: ResourceKind): boolean {
  return MATRIX[role]?.[resource]?.[action] ?? false;
}

export function isAdmin(role: Role): boolean {
  return role === "ADMIN";
}

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administrator",
  ANALYST: "Analyst",
  VIEWER: "Viewer",
};
