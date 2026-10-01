import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

/**
 * Password hashing — scrypt with a per-password random salt.
 * Format: scrypt$N$r$p$saltB64$hashB64
 * Plaintext passwords are never stored or logged.
 */
export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(plain.normalize("NFKC"), salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  try {
    const [scheme, nStr, rStr, pStr, saltB64, hashB64] = stored.split("$");
    if (scheme !== "scrypt") return false;
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(hashB64, "base64");
    const derived = scryptSync(plain.normalize("NFKC"), salt, expected.length, {
      N: Number(nStr),
      r: Number(rStr),
      p: Number(pStr),
    });
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("hex");
}
