import { NextResponse, type NextRequest } from "next/server";

// Login gate. Runs on the edge, so it uses Web Crypto (not node:crypto) to
// verify the signed session cookie. Unauthenticated requests are sent to
// /login; the signing pages (/sign/<token>) stay public so external signers
// can open their links without an account.

const SESSION_COOKIE = "psi_session";
const PUBLIC_PREFIXES = ["/login", "/sign"];

function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 2 ? "==" : s.length % 4 === 3 ? "=" : "";
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function verify(token: string | undefined, secret: string): Promise<boolean> {
  if (!token) return false;
  const [p, sig] = token.split(".");
  if (!p || !sig) return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const ok = await crypto.subtle.verify("HMAC", key, b64urlToBytes(sig), new TextEncoder().encode(p));
    if (!ok) return false;
    const data = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)));
    return !(data.exp && Date.now() > data.exp);
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const secret = process.env.AUTH_SECRET || "dev-insecure-secret-change-me";
  const authed = await verify(req.cookies.get(SESSION_COOKIE)?.value, secret);

  if (!authed && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  // Already signed in but sitting on /login → send to the app.
  if (authed && pathname === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"],
};
