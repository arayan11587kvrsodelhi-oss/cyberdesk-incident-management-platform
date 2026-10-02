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

const isDev = process.env.NODE_ENV === "development";

/**
 * Content-Security-Policy, built per request so the nonce is fresh and
 * unpredictable. Next.js and React read the nonce back from the `x-nonce`
 * request header and stamp it onto the inline bootstrap scripts they emit,
 * which is what lets the app run without `'unsafe-inline'` on `script-src`.
 *
 * Compatibility decisions (documented as an accepted limitation in the Phase 6
 * report rather than hidden):
 *  - `style-src` keeps `'unsafe-inline'`. Tailwind CSS and Framer Motion emit
 *    runtime <style> elements and style attributes that cannot be nonced
 *    without an architecture change well outside Phase 6 scope. Inline *style*
 *    is a materially weaker XSS vector than inline *script*.
 *  - `script-src` is strict: nonce + `'strict-dynamic'`, no `'unsafe-inline'`
 *    and no wildcard in production. `'unsafe-eval'` is development-only, where
 *    React's dev tooling depends on eval for readable component stacks.
 *  - `upgrade-insecure-requests` is omitted in development so plain-http
 *    localhost assets are not rewritten to https.
 */
function buildCsp(nonce: string): string {
  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com data:`,
    `img-src 'self' blob: data:`,
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `manifest-src 'self'`,
    `worker-src 'self' blob:`,
  ];
  if (!isDev) directives.push(`upgrade-insecure-requests`);
  return directives.join("; ");
}

function buildNonce(): string {
  // btoa (not Buffer) keeps this valid in the Edge runtime the middleware
  // executes in.
  return btoa(crypto.randomUUID());
}

/** Mirrors the framework defaults onto any response this middleware returns. */
function withSecurityHeaders(res: NextResponse, csp: string): NextResponse {
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  );
  if (!isDev) {
    res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
  return res;
}

/**
 * Edge-level session gate: checks cookie presence only (the database check
 * happens in the layout / API routes, where the real session lookup runs).
 * Middleware is deliberately thin — no secrets, no DB access, no role data.
 *
 * It also emits the per-request CSP header. A nonce forces dynamic rendering,
 * which is correct here: every dashboard page is user-specific and must never
 * be statically cached or shared between users.
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
    return withSecurityHeaders(NextResponse.redirect(url), buildCsp(buildNonce()));
  }

  if (AUTH_PAGES.includes(pathname) && hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return withSecurityHeaders(NextResponse.redirect(url), buildCsp(buildNonce()));
  }

  const nonce = buildNonce();
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  return withSecurityHeaders(NextResponse.next({ request: { headers: requestHeaders } }), csp);
}

export const config = {
  matcher: [
    /*
     * All page requests, excluding Next.js static assets and API routes.
     * API responses are JSON and receive their headers from next.config.ts.
     */
    {
      source: "/((?!_next/static|_next/image|favicon.ico|images|api).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
