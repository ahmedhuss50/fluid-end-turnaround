"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function I({ d }: { d: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {d}
    </svg>
  );
}

export default function Sidebar({ units, active, requests }: { units: number; active: number; requests: number }) {
  const path = usePathname();
  const is = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);

  const items = [
    {
      href: "/",
      label: "Dashboard",
      count: active,
      icon: <><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>,
    },
    {
      href: "/units",
      label: "Fluid Ends",
      count: units,
      icon: <><path d="M3 7l9-4 9 4-9 4-9-4Z" /><path d="M3 7v10l9 4 9-4V7" /><path d="M12 11v10" /></>,
    },
    {
      href: "/requests",
      label: "Repair Requests",
      count: requests,
      icon: <><path d="M9 4h6a1 1 0 0 1 1 1v1h2a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h2V5a1 1 0 0 1 1-1Z" /><path d="M9 6h6" /><path d="M9 12h6M9 16h4" /></>,
    },
    {
      href: "/jobs/new",
      label: "New Work Order",
      count: null,
      icon: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    },
    {
      href: "/pressure-test",
      label: "Pressure Test",
      count: null,
      icon: <><path d="M12 3a9 9 0 0 1 9 9" /><path d="M3 12a9 9 0 0 1 9-9" /><path d="M3 12a9 9 0 0 0 9 9 9 9 0 0 0 9-9" /><path d="M12 12l4-3" /><circle cx="12" cy="12" r="1.4" /></>,
    },
  ];

  return (
    <aside className="sidebar">
      <div className="nav-label">Workspace</div>
      {items.map((it) => (
        <Link key={it.href} href={it.href} className={`side-link${is(it.href) ? " active" : ""}`}>
          <span className="si"><I d={it.icon} /></span>
          {it.label}
          {it.count != null && it.count > 0 && <span className="count">{it.count}</span>}
        </Link>
      ))}
    </aside>
  );
}
