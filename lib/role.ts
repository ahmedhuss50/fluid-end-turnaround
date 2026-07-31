import { cookies } from "next/headers";
import { getSession } from "@/lib/auth/session";

export type Role = "psi" | "client";

/**
 * The current view role. The `role` cookie (set at login and by the demo
 * PSI/Client toggle) wins; otherwise fall back to the logged-in user's own
 * role; default to PSI.
 */
export function getRole(): Role {
  const v = cookies().get("role")?.value;
  if (v === "client" || v === "psi") return v;
  return getSession()?.role ?? "psi";
}
