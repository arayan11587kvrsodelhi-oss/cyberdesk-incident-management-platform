import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { registerSchema } from "@/validators";
import { hashPassword } from "@/lib/password";
import { ApiError } from "@/lib/api-error";
import { handle } from "@/server/http";
import { assertSameOrigin, requestMeta, startSession } from "@/server/auth";
import { logActivity } from "@/server/activity";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  return handle(async () => {
    await assertSameOrigin();
    const body = await req.json();
    const input = registerSchema.parse(body);

    const ip = clientIp(req.headers);
    const gate = rateLimit(`register:${ip}`, 5, 15 * 60 * 1000);
    if (!gate.ok) {
      throw new ApiError(429, "RATE_LIMITED", "Too many accounts created from this address. Try again later.");
    }

    const email = input.email.toLowerCase();
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing.length) {
      throw new ApiError(409, "EMAIL_TAKEN", "An account with that email already exists.", {
        email: "That email is already registered",
      });
    }

    // Self-registered accounts start as ANALYST. Administrators are
    // provisioned by an existing admin (see /team) or by the demo seed.
    const [created] = await db
      .insert(users)
      .values({
        name: input.name,
        email,
        passwordHash: hashPassword(input.password),
        role: "ANALYST",
        status: "ACTIVE",
        title: "Analyst",
      })
      .returning();

    const meta = await requestMeta();
    await startSession(created, meta.ua, meta.ip);

    await logActivity({
      actorId: created.id,
      actorName: created.name,
      action: "user.registered",
      entityType: "user",
      entityId: created.id,
      entityKey: null,
      summary: `${created.name} joined the workspace as an analyst`,
    });

    return {
      user: { id: created.id, name: created.name, email: created.email, role: created.role },
      redirect: "/dashboard",
    };
  });
}
