import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { forgotSchema } from "@/validators";
import { handle } from "@/server/http";
import { assertSameOrigin } from "@/server/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { ApiError } from "@/lib/api-error";
import { logActivity } from "@/server/activity";
import { createResetToken } from "@/server/reset";

/**
 * Generates a single-use reset token. Email delivery is intentionally not
 * implemented. In development, the token is returned so the local demo can be
 * exercised end-to-end. In production, the token is never returned to the client.
 * The response remains generic so accounts cannot be enumerated.
 */
export async function POST(req: Request) {
  return handle(async () => {
    await assertSameOrigin();
    const { email } = forgotSchema.parse(await req.json());

    const ip = clientIp(req.headers);
    const gate = rateLimit(`forgot:${ip}`, 5, 15 * 60 * 1000);
    if (!gate.ok) {
      throw new ApiError(429, "RATE_LIMITED", "Too many reset requests. Please try again in a few minutes.");
    }

    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    const generic = {
      ok: true as const,
      message: "If an account exists for that address, a reset link has been generated.",
      demoToken: null as string | null,
    };

    if (!user) return generic;

    const token = await createResetToken(user.id);

    await logActivity({
      actorId: user.id,
      actorName: user.name,
      action: "auth.reset_requested",
      entityType: "user",
      entityId: user.id,
      entityKey: null,
      summary: `${user.name} requested a password reset`,
    });

    return process.env.NODE_ENV === "production" ? generic : { ...generic, demoToken: token };
  });
}
