import { db } from "@/db";
import { activityLogs } from "@/db/schema";

export type ActivityInput = {
  actorId?: number | null;
  actorName: string;
  action: string;
  entityType: string;
  entityId?: number | null;
  entityKey?: string | null;
  summary: string;
};

/** Records a non-sensitive operational event. Never pass passwords, tokens or secrets. */
export async function logActivity(input: ActivityInput) {
  try {
    await db.insert(activityLogs).values({
      actorId: input.actorId ?? null,
      actorName: input.actorName,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      entityKey: input.entityKey ?? null,
      summary: input.summary.slice(0, 400),
    });
  } catch {
    // Activity logging must never break the primary mutation.
  }
}
