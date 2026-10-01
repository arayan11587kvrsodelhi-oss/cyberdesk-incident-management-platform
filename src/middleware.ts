import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/incidents",
  "/alerts",
  "/assets",
  "/investigations",
  "/tasks",
  "/team",
  "/settings",
];

const AUTH_PAGES = ["/login", "/register", "/forgot-password", "/reset-password"];

/**
 * Edge-level session gate: checks cookie presence only (the database check
 * happens in the layout / API routes, where the real session lookup runs).
 * Middleware is deliberately thin — no secrets, no DB access, no role data.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get("cd_session")?.value);

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isProtected && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (AUTH_PAGES.includes(pathname) && hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images|api).*)"],
};
