import ms from "ms";
import type { SignOptions } from "jsonwebtoken";

/** Default: long-lived browser session until explicit logout (override with JWT_EXPIRES_IN). */
const DEFAULT_JWT_EXPIRES_IN = "30d";

/**
 * Same value passed to `jwt.sign(..., { expiresIn })` and used to derive cookie `maxAge`.
 * Examples: `8h`, `7d`, `30d`, `90d` (see jsonwebtoken / ms parsing).
 */
export function getJwtExpiresIn(): NonNullable<SignOptions["expiresIn"]> {
  const raw = process.env.JWT_EXPIRES_IN?.trim();
  return (raw || DEFAULT_JWT_EXPIRES_IN) as NonNullable<SignOptions["expiresIn"]>;
}

/** Milliseconds for `res.cookie(..., { maxAge })` — must stay aligned with JWT `exp`. */
export function getSessionCookieMaxAgeMs(): number {
  const expiresIn = String(getJwtExpiresIn());
  const parsed = ms(expiresIn as ms.StringValue);
  if (typeof parsed !== "number" || !Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid JWT_EXPIRES_IN: ${expiresIn}`);
  }
  return parsed;
}
