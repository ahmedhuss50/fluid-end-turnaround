import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Fluid End Turnaround System",
  description: "Digital turnaround documentation with dual e-signature (Phase 1).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="nav">
          <div className="nav-inner">
            <Link href="/" className="brand">
              <span className="dot" />
              Fluid End Turnaround
            </Link>
            <Link href="/" className="link">Dashboard</Link>
            <Link href="/units" className="link">Fluid Ends</Link>
            <span className="spacer" />
            <Link href="/jobs/new" className="btn">+ New turnaround</Link>
          </div>
        </nav>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
