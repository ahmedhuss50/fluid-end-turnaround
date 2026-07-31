"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import { setSessionCookie, clearSessionCookie, getSession } from "@/lib/auth/session";

/** Email + password login. No email verification — validates against the User table. */
export async function login(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  if (!email || !password) redirect("/login?error=missing");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    redirect("/login?error=invalid");
  }

  const role = user.role === "psi" ? "psi" : "client";
  setSessionCookie({ uid: user.id, role, name: user.name, email: user.email, company: user.company });
  // Mirror the account role into the view cookie (the demo toggle also uses this).
  cookies().set("role", role, { path: "/", maxAge: 60 * 60 * 24 * 30 });
  redirect(role === "client" ? "/requests" : "/");
}

/** Let the signed-in user change their own password. */
export async function changePassword(formData: FormData) {
  const session = getSession();
  if (!session) redirect("/login");

  const current = String(formData.get("current") || "");
  const next = String(formData.get("next") || "");
  const confirm = String(formData.get("confirm") || "");

  if (!current || !next || !confirm) redirect("/account?error=missing");
  if (next.length < 8) redirect("/account?error=short");
  if (next !== confirm) redirect("/account?error=mismatch");

  const user = await prisma.user.findUnique({ where: { id: session.uid } });
  if (!user || !verifyPassword(current, user.passwordHash)) redirect("/account?error=current");
  if (verifyPassword(next, user.passwordHash)) redirect("/account?error=same");

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(next) } });
  redirect("/account?changed=1");
}

/** Sign out: clear the session (and view cookie) and return to the login page. */
export async function logout() {
  clearSessionCookie();
  cookies().set("role", "", { path: "/", maxAge: 0 });
  redirect("/login");
}
