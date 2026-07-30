"use client";

import { useEffect, useState } from "react";
import { markNotificationsRead } from "@/app/actions";

export type InboxItem = {
  id: string;
  type: string;
  subject: string;
  preview: string;
  toName: string | null;
  toEmail: string | null;
  emailedAt: string | null;
  createdAt: string;
  jobNumber: string;
  signToken: string | null;
  emailHtml: string;
};

function when(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function NotificationInbox({ items, recipient }: { items: InboxItem[]; recipient: string }) {
  const [open, setOpen] = useState<string | null>(items[0]?.id ?? null);

  // Opening the inbox clears the unread badge.
  useEffect(() => {
    markNotificationsRead(recipient).catch(() => {});
  }, [recipient]);

  if (items.length === 0) {
    return (
      <div className="card">
        <div className="empty">
          <div className="big">No notifications yet</div>
          <div>When PSI signs off a work order, the email and portal alert sent to the operator appear here.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      {items.map((n) => {
        const isOpen = open === n.id;
        const done = n.type === "COMPLETED";
        return (
          <div key={n.id} className="card">
            <div
              className="card-body"
              style={{ display: "flex", gap: 14, alignItems: "flex-start", cursor: "pointer" }}
              onClick={() => setOpen(isOpen ? null : n.id)}
            >
              <span
                aria-hidden
                style={{
                  flex: "none", width: 38, height: 38, borderRadius: 10, display: "inline-flex",
                  alignItems: "center", justifyContent: "center", fontSize: 18,
                  background: done ? "var(--green-bg)" : "var(--red-bg)",
                  color: done ? "var(--green)" : "var(--red)",
                }}
              >
                {done ? "✓" : "✉"}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{n.subject}</div>
                <div className="small muted" style={{ marginTop: 2 }}>{n.preview}</div>
                <div className="small muted" style={{ marginTop: 6 }}>
                  <span className={`badge ${done ? "completed" : "awaiting"}`}>
                    <span className="d" />{done ? "Certificate ready" : "Sign-off requested"}
                  </span>
                  {"  "}
                  {n.emailedAt
                    ? <>📧 Email sent to <strong>{n.toEmail}</strong> · {when(n.emailedAt)}</>
                    : <>Queued for {n.toEmail}</>}
                </div>
              </div>
              <div className="small" style={{ color: "var(--red)", fontWeight: 600, whiteSpace: "nowrap" }}>
                {isOpen ? "Hide email ▲" : "View email ▼"}
              </div>
            </div>

            {isOpen && (
              <div style={{ borderTop: "1px solid var(--line)", padding: 16, background: "#f4f1ea" }}>
                <div className="small muted" style={{ marginBottom: 8 }}>
                  <strong>To:</strong> {n.toName} &lt;{n.toEmail}&gt; &nbsp; <strong>Subject:</strong> {n.subject}
                </div>
                <iframe
                  title={`email-${n.id}`}
                  srcDoc={n.emailHtml}
                  style={{ width: "100%", height: 520, border: "1px solid var(--line)", borderRadius: 10, background: "#fff" }}
                />
                {n.signToken && (
                  <div style={{ marginTop: 12 }}>
                    <a href={`/sign/${n.signToken}`} className="btn small" target="_blank" rel="noopener">
                      Open the sign-off page →
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
