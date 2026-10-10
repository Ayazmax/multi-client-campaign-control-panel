import { createHash, randomBytes } from "node:crypto";

const COOKIE = "session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function cookieFlags() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `HttpOnly; SameSite=Lax; Path=/${secure}`;
}

export function createSessionToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function readSessionToken(req) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function setSessionCookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=${encodeURIComponent(token)}; ${cookieFlags()}; Max-Age=${MAX_AGE_SECONDS}`,
  );
}

export function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE}=; ${cookieFlags()}; Max-Age=0`);
}

export function sessionExpiry(from = new Date()) {
  return new Date(from.getTime() + MAX_AGE_SECONDS * 1000);
}
