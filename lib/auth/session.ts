import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "psi_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export interface Session {
  uid: string;
  role: "psi" | "client";
  name: string;
  email: string;
  company?: string | null;
  exp: number; // epoch ms
}

/** HMAC secret. Set AUTH_SECRET in production; a dev fallback keeps things working locally. */
function secret(): string {
  return process.env.AUTH_SECRET || "dev-insecure-secret-change-me";
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlToBuf(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

/** Sign a session payload into a compact "<payload>.<sig>" token. */
export function signSession(data: Omit<Session, "exp">, maxAgeSec = MAX_AGE): string {
  const payload: Session = { ...data, exp: Date.now() + maxAgeSec * 1000 };
  const p = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = b64url(createHmac("sha256", secret()).update(p).digest());
  return `${p}.${sig}`;
}

/** Verify + decode a token. Returns null if tampered or expired. */
export function verifySession(token: string | undefined): Session | null {
  if (!token) return null;
  const [p, sig] = token.split(".");
  if (!p || !sig) return null;
  const expected = createHmac("sha256", secret()).update(p).digest();
  const got = b64urlToBuf(sig);
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
  try {
    const data = JSON.parse(b64urlToBuf(p).toString("utf8")) as Session;
    if (!data.exp || Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

/** Read the current session from the request cookies (server components/actions). */
export function getSession(): Session | null {
  return verifySession(cookies().get(SESSION_COOKIE)?.value);
}

/** Persist a session cookie (httpOnly) for a signed-in user. */
export function setSessionCookie(data: Omit<Session, "exp">) {
  cookies().set(SESSION_COOKIE, signSession(data), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export function clearSessionCookie() {
  cookies().set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
}
