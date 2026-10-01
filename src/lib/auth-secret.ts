const DEV_AUTH_SECRET = "cyberdesk-development-secret";

/**
 * Returns the session/reset HMAC secret. Production must provide a real secret;
 * the development fallback exists only to keep the demo easy to run locally.
 */
export function getAuthSecret(): string {
  const configured = process.env.AUTH_SECRET?.trim();
  if (configured) {
    if (process.env.NODE_ENV === "production" && configured.length < 32) {
      throw new Error("AUTH_SECRET must be at least 32 characters in production.");
    }
    return configured;
  }

  if (process.env.NODE_ENV !== "production") return DEV_AUTH_SECRET;

  throw new Error("AUTH_SECRET is required in production.");
}
