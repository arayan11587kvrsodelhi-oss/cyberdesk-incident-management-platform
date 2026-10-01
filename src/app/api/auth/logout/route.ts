import { handle } from "@/server/http";
import { endSession } from "@/server/auth";

export async function POST(req: Request) {
  // Logout is session-related and state-changing — same-origin gate applies.
  return handle(async () => {
    await endSession();
    return { ok: true };
  }, 200, req);
}
