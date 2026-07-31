"use client";

import { useTransition } from "react";
import { setRole } from "@/app/actions";

export default function RoleSwitch({ role }: { role: string }) {
  const [pending, start] = useTransition();

  // Set the cookie server-side, then do a FULL-DOCUMENT navigation to the
  // role's landing page. The hard navigation forces a fresh server render of
  // the layout (and sidebar), bypassing Next's client Router Cache — which
  // otherwise sometimes served the previous role's sidebar for a path already
  // visited under the other role.
  const pick = (r: string) => {
    if (r === role || pending) return;
    start(async () => {
      await setRole(r);
      window.location.assign(r === "client" ? "/requests" : "/");
    });
  };

  return (
    <span className="lang" title="Switch view — for the demo" style={{ opacity: pending ? 0.6 : 1 }}>
      <span className={role === "psi" ? "on" : ""} onClick={() => pick("psi")} style={{ cursor: "pointer" }}>PSI</span>
      <span className={role === "client" ? "on" : ""} onClick={() => pick("client")} style={{ cursor: "pointer" }}>Client</span>
    </span>
  );
}
