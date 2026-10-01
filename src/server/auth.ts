import { createHmac } from "node:crypto";
import { cookies, headers } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { randomToken } from "@/lib/password";
import { getAuthSecret } from "@/lib/auth-secret";
import { ApiError } from "@/lib/api-error";
import type { Role } from "@/lib/permissions";

export const SESSION_COOKIE = "cd_session";
const SESSION_DAYS = 7;

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: Role;
  status: "ACTIVE" | "DEACTIVATED";
  title: string | null;
  createdAt: Date;
};

/**
 * Session tokens are stored only as an HMAC keyed by AUTH_SECRET, so a
 * database dump alone never yields a usable session.
 */
function hash(token: string) {
  return createHmac("sha256", getAuthSecret())
    .update(token)
    .digest("hex");
}

export async function startSession(user: { id: number }, ua?: string | null, ip?: string | null) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const [created] = await db.insert(sessions).values({
    tokenHash: hash(token),
    userId: user.id,
    userAgent: ua?.slice(0, 200) ?? null,
    ip: ip ?? null,
    expiresAt,
  }).returning({ id: sessions.id });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return created.id;
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hash(token))).catch(() => undefined);
  }
  jar.delete(SESSION_COOKIE);
}

export type AuthContext = { user: SessionUser; sessionId: number };

/** Resolves the authenticated user from the session cookie. Returns null when logged out. */
export async function getSession(): Promise<AuthContext | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  let row;
  try {
    row = await db
      .select({
        sessionId: sessions.id,
        expiresAt: sessions.expiresAt,
        lastSeenAt: sessions.lastSeenAt,
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        status: users.status,
        title: users.title,
        createdAt: users.createdAt,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.tokenHash, hash(token)), gt(sessions.expiresAt, new Date())))
      .limit(1);
  } catch {
    throw new ApiError(503, "DB_UNAVAILABLE", "The data service is unavailable right now. Please try again shortly.");
  }

  const found = row[0];
  if (!found) return null;
  if (found.status !== "ACTIVE") return null;

  // Refresh last-seen at most once a minute to keep writes cheap.
  if (Date.now() - found.lastSeenAt.getTime() > 60_000) {
    await db
      .update(sessions)
      .set({ lastSeenAt: new Date() })
      .where(eq(sessions.id, found.sessionId))
      .catch(() => undefined);
  }

  const { expiresAt, lastSeenAt: _ls, ...user } = found;
  return { user: user as SessionUser, sessionId: found.sessionId };
}

/** For API routes: authenticated user or a 401 error. */
export async function requireUser(): Promise<SessionUser> {
  const ctx = await getSession();
  if (!ctx) throw new ApiError(401, "UNAUTHORIZED", "Your session has expired. Please sign in again.");
  return ctx.user;
}

/** For server components / pages: returns null when logged out. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const ctx = await getSession();
    return ctx?.user ?? null;
  } catch {
    return null;
  }
}

export async function requireRole(role: Role): Promise<SessionUser> {
  const user = await requireUser();
  const rank = { VIEWER: 0, ANALYST: 1, ADMIN: 2 };
  if (rank[user.role] < rank[role]) {
    throw new ApiError(403, "FORBIDDEN", "Your role does not permit this action.");
  }
  return user;
}

export async function requestMeta() {
  const h = await headers();
  return {
    ip:
      h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown",
    ua: h.get("user-agent"),
    origin: h.get("origin"),
    host: h.get("host"),
  };
}

/**
 * CSRF-conscious check for state-changing requests: same-site cookie + origin
 * must match the host we are serving. Rejects cross-site forged POSTs.
 */
export async function assertSameOrigin() {
  const { origin, host } = await requestMeta();
  if (!origin || !host) return;
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError(403, "FORBIDDEN", "Request blocked for security reasons.");
  }
  if (originHost !== host) {
    throw new ApiError(403, "FORBIDDEN", "Request blocked for security reasons.");
  }
}
