import "./globals.css";
import type { Metadata } from "next";
import { Inter, Roboto_Slab } from "next/font/google";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { JOB_STATUS } from "@/lib/constants";
import Sidebar from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const slab = Roboto_Slab({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-slab", display: "swap" });

export const metadata: Metadata = {
  title: "PSI Portal — Fluid End Turnaround",
  description: "Digital turnaround documentation with dual e-signature.",
};

// PSI pump-jack placeholder mark. Swap for the real PSI logo (see note in README).
function PumpJack() {
  return (
    <svg viewBox="0 0 48 40" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="35" x2="43" y2="35" />
      <path d="M17 35 L23 15 L29 35" />
      <line x1="10" y1="13" x2="38" y2="21" />
      <circle cx="38" cy="22" r="4.2" fill="currentColor" stroke="none" />
      <path d="M10 13 L8 21" />
      <line x1="23" y1="15" x2="23" y2="35" />
    </svg>
  );
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let units = 0;
  let active = 0;
  try {
    const [u, a] = await Promise.all([
      prisma.fluidEnd.count(),
      prisma.turnaroundJob.count({
        where: { status: { in: [JOB_STATUS.DRAFT, JOB_STATUS.AWAITING_PSI, JOB_STATUS.AWAITING_OPERATOR] } },
      }),
    ]);
    units = u;
    active = a;
  } catch {
    /* DB may be unavailable during build; render zero counts */
  }

  return (
    <html lang="en" className={`${inter.variable} ${slab.variable}`}>
      <body>
        <div className="thintop" />
        <header className="topbar">
          <Link href="/" className="brand">
            <span className="logo"><PumpJack /></span>
            <span className="word">PSI Portal<span className="oil">OILFIELD SERVICES</span></span>
          </Link>
          <span className="crumb-sep">/</span>
          <span className="crumb-app">Fluid End Turnaround</span>
          <span className="top-spacer" />
          <span className="top-user">Ahmed</span>
          <span className="lang"><span className="on">EN</span><span>ES</span></span>
        </header>

        <div className="app">
          <Sidebar units={units} active={active} />
          <div className="main">
            <div className="content">{children}</div>
          </div>
        </div>
      </body>
    </html>
  );
}
