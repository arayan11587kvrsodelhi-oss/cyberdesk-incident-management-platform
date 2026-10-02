import type { NextConfig } from "next";

/**
 * Production security headers.
 *
 * Note on CSP: the Content-Security-Policy header itself is emitted per-request
 * from `src/middleware.ts`, because it carries a freshly generated nonce.
 * The headers configured here are static and safe to attach to every response.
 */
const securityHeaders = [
  // Never let a browser second-guess a declared content type (MIME confusion).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Do not leak internal paths to third parties.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Defence in depth against clickjacking; the CSP `frame-ancestors 'none'`
  // directive is the primary control, this covers older browsers.
  { key: "X-Frame-Options", value: "DENY" },
  // Restrict powerful browser features the app never uses.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  // HSTS only matters over TLS, so it is limited to production traffic.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Authenticated/private API payloads are per-user: a shared cache entry
        // could be replayed to an anonymous or different caller.
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, private" },
          { key: "Pragma", value: "no-cache" },
          { key: "Vary", value: "Cookie, Authorization" },
        ],
      },
      {
        // Authenticated HTML pages must not be cached by the CDN or browser.
        source: "/:path((?!api|_next/static|_next/image|favicon.ico).*)",
        missing: [
          { type: "header", key: "next-router-prefetch" },
          { type: "header", key: "purpose", value: "prefetch" },
          { type: "header", key: "rsc", value: "1" },
        ],
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
