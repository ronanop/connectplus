import crypto from "crypto";

type Entry = { userId: number; expiresAt: number };

const store = new Map<string, Entry>();

function getSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) {
    throw new Error("JWT_SECRET is not configured");
  }
  return s;
}

function ttlMs(): number {
  const raw = process.env.GEO_VERIFICATION_TTL_MS;
  if (raw?.trim()) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 60_000 && n <= 60 * 60 * 1000) {
      return n;
    }
  }
  // Face models + camera + retries on mobile often exceed 5 minutes
  return 20 * 60 * 1000;
}

export function issueGeoVerificationToken(userId: number): string {
  const payload = `${userId}:${Date.now()}`;
  const token = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
  store.set(token, { userId, expiresAt: Date.now() + ttlMs() });
  return token;
}

export function consumeGeoVerificationToken(token: string, userId: number): boolean {
  const entry = store.get(token);
  if (!entry) {
    return false;
  }
  if (entry.userId !== userId) {
    return false;
  }
  if (Date.now() > entry.expiresAt) {
    store.delete(token);
    return false;
  }
  store.delete(token);
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store.entries()) {
    if (v.expiresAt < now) {
      store.delete(k);
    }
  }
}, 10 * 60 * 1000);
