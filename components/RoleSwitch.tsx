"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setRole } from "@/app/actions";

export default function RoleSwitch({ role }: { role: string }) {
  const [, start] = useTransition();
  const router = useRouter();
  const pick = (r: string) =>
    start(async () => {
      await setRole(r);
      router.refresh();
    });

  return (
    <span className="lang" title="Switch view — for the demo">
      <span className={role === "psi" ? "on" : ""} onClick={() => pick("psi")} style={{ cursor: "pointer" }}>PSI</span>
      <span className={role === "client" ? "on" : ""} onClick={() => pick("client")} style={{ cursor: "pointer" }}>Pro Petro</span>
    </span>
  );
}
