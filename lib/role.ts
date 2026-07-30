import { cookies } from "next/headers";

export type Role = "psi" | "client";

/** Current view role from the `role` cookie (defaults to PSI). */
export function getRole(): Role {
  const v = cookies().get("role")?.value;
  return v === "client" ? "client" : "psi";
}
