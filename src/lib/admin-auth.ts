import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "mathsmock_admin";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

function configuredSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error("Admin authentication needs an AUTH_SECRET of at least 32 characters.");
  }
  return secret;
}

export function hasAdminCredentials(): boolean {
  return Boolean(
    process.env.ADMIN_USERNAME &&
      process.env.ADMIN_PASSWORD &&
      process.env.AUTH_SECRET &&
      Buffer.byteLength(process.env.AUTH_SECRET) >= 32,
  );
}

function equalSecret(actual: string, expected: string): boolean {
  const actualHash = createHash("sha256").update(actual).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actualHash, expectedHash);
}

export function validateAdminCredentials(username: string, password: string): boolean {
  const expectedUsername = process.env.ADMIN_USERNAME;
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedUsername || !expectedPassword || !hasAdminCredentials()) return false;
  return equalSecret(username, expectedUsername) && equalSecret(password, expectedPassword);
}

export function createAdminSession(username: string): string {
  const payload = Buffer.from(
    JSON.stringify({ username, expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000 }),
  ).toString("base64url");
  const signature = createHmac("sha256", configuredSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyAdminSession(token: string | undefined): boolean {
  const secret = process.env.AUTH_SECRET;
  if (
    !token ||
    !process.env.ADMIN_USERNAME ||
    !process.env.ADMIN_PASSWORD ||
    !secret ||
    Buffer.byteLength(secret) < 32
  ) {
    return false;
  }
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return false;

  const expected = createHmac("sha256", secret).update(payload).digest();
  const received = Buffer.from(signature, "base64url");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return false;

  try {
    const data: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (
      typeof data !== "object" ||
      data === null ||
      !("username" in data) ||
      !("expiresAt" in data) ||
      data.username !== process.env.ADMIN_USERNAME ||
      typeof data.expiresAt !== "number" ||
      data.expiresAt <= Date.now()
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
