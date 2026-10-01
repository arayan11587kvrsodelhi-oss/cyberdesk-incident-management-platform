import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { resetSchema } from "@/validators";
import { ApiError } from "@/lib/api-error";
import { handle } from "@/server/http";
import { assertSameOrigin } from "@/server/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { consumeResetToken } from "@/server/reset";
import { logActivity } from "@/server/activity";

export async function POST(req: Request) {
  return handle(async () => {
    await assertSameOrigin();
    const input = resetSchema.parse(await req.json());

    const ip = clientIp(req.headers);
    const gate = rateLimit(`reset:${ip}`, 8, 15 * 60 * 1000);
    if (!gate.ok) {
      throw new ApiError(429, "RATE_LIMITED", "Too many reset attempts. Please wait a few minutes.");
    }

    const user = await consumeResetToken(input.token, input.password);
    if (!user) {
      throw new ApiError(400, "INVALID_TOKEN", "That reset link is invalid or has expired. Request a new one.");
    }

    await logActivity({
      actorId: user.id,
      actorName: user.name,
      action: "auth.password_reset",
      entityType: "user",
      entityId: user.id,
      entityKey: null,
      summary: `${user.name} reset their password`,
    });

    return { ok: true, message: "Password updated. You can now sign in with your new password." };
  });
}

export async function GET() {
  return handle(async () => {
    const [row] = await db.select({ n: users.id }).from(users).limit(1);
    return { ok: Boolean(row) };
  });
}
