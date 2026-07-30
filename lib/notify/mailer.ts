// Pluggable outbound email. Swap the driver via NOTIFY_PROVIDER without touching
// callers. The "mock" driver records the message instead of sending it, so the
// whole notification flow is demonstrable before a real email account is wired up.

export interface EmailMessage {
  toName?: string | null;
  toEmail: string;
  subject: string;
  html: string;
}

export interface SendResult {
  ok: boolean;
  provider: string;
  ref?: string;
  error?: string;
}

export interface Mailer {
  name: string;
  send(msg: EmailMessage): Promise<SendResult>;
}

/** Records the email (console) instead of delivering it. Used for the demo. */
class MockMailer implements Mailer {
  name = "mock";
  async send(msg: EmailMessage): Promise<SendResult> {
    // eslint-disable-next-line no-console
    console.log(`[notify:mock] would email ${msg.toEmail} — "${msg.subject}"`);
    return { ok: true, provider: "mock", ref: `mock-${Date.now()}` };
  }
}

/**
 * Resend driver — real delivery. Enabled by setting NOTIFY_PROVIDER=resend and
 * RESEND_API_KEY. Kept dependency-free (uses fetch) so nothing extra installs
 * until you actually turn it on.
 */
class ResendMailer implements Mailer {
  name = "resend";
  async send(msg: EmailMessage): Promise<SendResult> {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.NOTIFY_FROM || "PSI Portal <notifications@psi.example>";
    if (!key) return { ok: false, provider: "resend", error: "RESEND_API_KEY not set" };
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: [msg.toEmail],
          subject: msg.subject,
          html: msg.html,
        }),
      });
      if (!res.ok) return { ok: false, provider: "resend", error: `HTTP ${res.status}` };
      const data = (await res.json()) as { id?: string };
      return { ok: true, provider: "resend", ref: data.id };
    } catch (e) {
      return { ok: false, provider: "resend", error: (e as Error).message };
    }
  }
}

export function getMailer(): Mailer {
  return process.env.NOTIFY_PROVIDER === "resend" ? new ResendMailer() : new MockMailer();
}
