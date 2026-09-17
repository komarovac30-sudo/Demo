import { createHmac, timingSafeEqual } from "crypto";

function secret() {
  const value = process.env.UNLOCK_SESSION_SECRET || process.env.SUPABASE_SECRET_KEY;
  if (!value) throw new Error("Unlock session secret is not configured.");
  return value;
}

export function unlockCookieName(creatorId: string) {
  return `veloura_unlock_${creatorId.replace(/-/g, "").slice(0, 16)}`;
}

function signature(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function createUnlockToken(creatorId: string, ttlSeconds = 3600) {
  const payload = Buffer.from(JSON.stringify({ creatorId, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifyUnlockToken(token: string | undefined, creatorId: string) {
  if (!token) return false;
  const [payload, provided] = token.split(".");
  if (!payload || !provided) return false;
  const expected = signature(payload);
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { creatorId?: string; exp?: number };
    return parsed.creatorId === creatorId && Number(parsed.exp || 0) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function hashUnlockCode(creatorId: string, code: string) {
  return createHmac("sha256", secret()).update(`${creatorId}:${code.trim()}`).digest("hex");
}
