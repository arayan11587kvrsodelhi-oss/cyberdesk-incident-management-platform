import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { loginSchema } from "@/validators";
import { hashPassword, verifyPassword } from "@/lib/password";

/** Compared against when no account matches, so both branches cost the same. */
const EQUALIZER = hashPassword("cyberdesk-timing-equalizer");
import { ApiError } from "@/lib/api-error";
import { handle } from "@/server/http";
import { assertSameOrigin, requestMeta, startSession } from "@/server/auth";
import { logActivity } from "@/server/activity";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  return handle(async () => {
    await assertSameOrigin();
    const body = await req.json();
    const { email, password } = loginSchema.parse(body);

    const ip = clientIp(req.headers);
    const gate = rateLimit(`login:${ip}:${email}`, 8, 5 * 60 * 1000);
    if (!gate.ok) {
      throw new ApiError(
        429,
        "RATE_LIMITED",
        `Too many sign-in attempts. Please wait ${gate.retryAfterSeconds} seconds and try again.`,
      );
    }

    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);

    // Constant-ish failure path: same message whether the account exists or not.
    const valid = verifyPassword(password, user ? user.passwordHash : EQUALIZER);
    if (!user || !valid) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "That email and password combination is not recognised.");
    }
    if (user.status !== "ACTIVE") {
      throw new ApiError(403, "DEACTIVATED", "This account has been deactivated. Contact your workspace administrator.");
    }

    const meta = await requestMeta();
    await startSession(user, meta.ua, meta.ip);

    await logActivity({
      actorId: user.id,
      actorName: user.name,
      action: "auth.login",
      entityType: "session",
      entityId: null,
      entityKey: null,
      summary: `${user.name} signed in to the workspace`,
    });

    return {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      redirect: "/dashboard",
    };
  });
}
