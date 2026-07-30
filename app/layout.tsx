import "./globals.css";
import type { Metadata } from "next";
import { Inter, Roboto_Slab } from "next/font/google";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { JOB_STATUS } from "@/lib/constants";
import { getRole } from "@/lib/role";
import Sidebar from "@/components/Sidebar";
import RoleSwitch from "@/components/RoleSwitch";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const slab = Roboto_Slab({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-slab", display: "swap" });

export const metadata: Metadata = {
  title: "PSI Portal — Fluid End Work Orders",
  description: "Digital work order documentation with dual e-signature.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const role = getRole();
  let units = 0;
  let active = 0;
  let requests = 0;
  try {
    const [u, a, r] = await Promise.all([
      prisma.fluidEnd.count(),
      prisma.turnaroundJob.count({
        where: { status: { in: [JOB_STATUS.DRAFT, JOB_STATUS.AWAITING_PSI, JOB_STATUS.AWAITING_OPERATOR] } },
      }),
      prisma.repairRequest.count({ where: { status: "SUBMITTED" } }),
    ]);
    units = u;
    active = a;
    requests = r;
  } catch {
    /* DB may be unavailable during build; render zero counts */
  }

  return (
    <html lang="en" className={`${inter.variable} ${slab.variable}`}>
      <body>
        <div className="thintop" />
        <header className="topbar">
          <Link href="/" className="brand">
            <span className="word">PSI Portal</span>
          </Link>
          <span className="crumb-sep">/</span>
          <span className="crumb-app">Fluid End work orders</span>
          <span className="top-spacer" />
          <span className="top-user">{role === "client" ? "Client" : "Ahmed · PSI"}</span>
          <RoleSwitch role={role} />
          <span className="lang"><span className="on">EN</span><span>ES</span></span>
        </header>

        <div className="app">
          <Sidebar units={units} active={active} requests={requests} role={role} />
          <div className="main">
            <div className="content">{children}</div>
          </div>
        </div>
      </body>
    </html>
  );
}
