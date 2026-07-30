import Link from "next/link";

/** Header bell for the operator portal, with an unread-count dot. */
export default function NotifBell({ count }: { count: number }) {
  return (
    <Link href="/notifications" className="notif-bell" title="Notifications" aria-label={`Notifications${count ? `, ${count} unread` : ""}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
      {count > 0 && <span className="notif-dot">{count > 9 ? "9+" : count}</span>}
    </Link>
  );
}
