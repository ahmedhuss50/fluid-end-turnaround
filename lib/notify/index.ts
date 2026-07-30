import { prisma } from "@/lib/db";
import { appBaseUrl } from "@/lib/jobs";
import { PARTY, NOTIFY_TYPE, DEMO_OPERATOR_EMAIL, PART_LABEL } from "@/lib/constants";
import { fmtMoney, computeTotals } from "@/lib/money";
import { getMailer, type EmailMessage } from "./mailer";

type JobForEmail = {
  id: string;
  jobNumber: string;
  technician: string;
  completedDate: Date | null;
  replacedParts: string;
  certificateUrl: string | null;
  fluidEnd: { serialNumber: string; manufacturer: string; customer: string; model: string | null };
  signatures: { party: string; signerName: string; signerEmail: string | null; token: string; status: string }[];
  invoice: {
    invoiceNumber: string;
    currency: string;
    taxRatePct: number;
    items: { quantity: number; unitPriceCents: number }[];
  } | null;
};

function parts(job: JobForEmail): string {
  try {
    const arr = JSON.parse(job.replacedParts);
    if (!Array.isArray(arr) || arr.length === 0) return "None recorded";
    return arr.map((p: string) => PART_LABEL[p] || p).join(", ");
  } catch {
    return "None recorded";
  }
}

/** Small inline-styled email shell so it renders identically in a real inbox. */
function shell(opts: { heading: string; tint: string; bodyRows: string; ctaLabel?: string; ctaHref?: string; ctaExtra?: string; footnote: string }): string {
  const cta = opts.ctaLabel && opts.ctaHref
    ? `<tr><td style="padding:6px 0 4px;">
         <a href="${opts.ctaHref}" style="display:inline-block;background:#c8102e;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 22px;border-radius:8px;">${opts.ctaLabel}</a>${opts.ctaExtra || ""}
       </td></tr>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f4f1ea;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1b1b1f;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:26px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #e9e4db;border-radius:14px;overflow:hidden;">
        <tr><td style="background:#c8102e;padding:16px 26px;">
          <span style="color:#ffffff;font-weight:700;font-size:17px;letter-spacing:.01em;">PSI Portal</span>
          <span style="color:#f6c9cf;font-size:13px;"> &nbsp;·&nbsp; Fluid End Work Orders</span>
        </td></tr>
        <tr><td style="height:5px;background:${opts.tint};"></td></tr>
        <tr><td style="padding:26px 26px 8px;">
          <div style="font-size:19px;font-weight:700;margin-bottom:6px;">${opts.heading}</div>
        </td></tr>
        <tr><td style="padding:0 26px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e9e4db;border-radius:10px;">
            ${opts.bodyRows}
          </table>
        </td></tr>
        <tr><td style="padding:14px 26px 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td>${cta}</td></tr></table>
          <div style="color:#8b9099;font-size:12px;margin-top:16px;line-height:1.5;">${opts.footnote}</div>
        </td></tr>
      </table>
      <div style="color:#a7a290;font-size:11px;margin-top:14px;">PSI Fluid End Work Order System · this is an automated notification</div>
    </td></tr>
  </table>
</body></html>`;
}

function row(k: string, v: string, mono = false): string {
  return `<tr>
    <td style="padding:9px 14px;border-bottom:1px solid #f0ece3;color:#8b9099;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;width:150px;">${k}</td>
    <td style="padding:9px 14px;border-bottom:1px solid #f0ece3;font-size:14px;${mono ? "font-family:ui-monospace,Menlo,monospace;" : ""}">${v}</td>
  </tr>`;
}

function unitRows(job: JobForEmail): string {
  return (
    row("Work order", job.jobNumber, true) +
    row("Serial #", job.fluidEnd.serialNumber, true) +
    row("Manufacturer", job.fluidEnd.manufacturer) +
    row("Parts replaced", parts(job)) +
    row("PSI technician", job.technician)
  );
}

/** Build the "PSI signed — please countersign" email. */
function buildSignRequestEmail(job: JobForEmail, base: string) {
  const op = job.signatures.find((s) => s.party === PARTY.PRO_PETRO);
  const psi = job.signatures.find((s) => s.party === PARTY.PSI);
  const toName = op?.signerName || "Operator Representative";
  const toEmail = op?.signerEmail || DEMO_OPERATOR_EMAIL;
  const signUrl = op ? `${base}/sign/${op.token}` : base;
  const subject = `Action needed: sign off work order ${job.jobNumber}`;
  const preview = `PSI completed ${job.jobNumber} (${job.fluidEnd.serialNumber}) and signed. Your countersignature is requested.`;
  const html = shell({
    heading: "Your sign-off is requested",
    tint: "#c8102e",
    bodyRows:
      unitRows(job) +
      row("PSI signed by", psi?.signerName ? `${psi.signerName} ✓` : "PSI ✓"),
    ctaLabel: "Review & sign →",
    ctaHref: signUrl,
    footnote:
      `PSI has completed this fluid end and signed off. Please review the work and add your countersignature to finalize the record and release the signed certificate. This request was sent to ${toEmail}.`,
  });
  return { subject, preview, html, toName, toEmail, signToken: op?.token || null };
}

/** Build the "completed — certificate + invoice ready" email. */
function buildCompletedEmail(job: JobForEmail, base: string) {
  const op = job.signatures.find((s) => s.party === PARTY.PRO_PETRO);
  const toName = op?.signerName || "Operator Representative";
  const toEmail = op?.signerEmail || DEMO_OPERATOR_EMAIL;
  const certUrl = job.certificateUrl ? `${base}${job.certificateUrl}` : `${base}/jobs/${job.id}`;
  const subject = `Certificate & invoice ready: work order ${job.jobNumber}`;
  const preview = `Both parties signed ${job.jobNumber}. The signed certificate and invoice are ready.`;

  let invoiceRows = "";
  let invoiceCta = "";
  let invoiceLine = "";
  if (job.invoice) {
    const { totalCents } = computeTotals(job.invoice.items, job.invoice.taxRatePct);
    const totalStr = fmtMoney(totalCents, job.invoice.currency);
    const invUrl = `${base}/invoice/${encodeURIComponent(job.invoice.invoiceNumber)}`;
    invoiceRows =
      row("Invoice", job.invoice.invoiceNumber, true) +
      `<tr>
        <td style="padding:9px 14px;color:#8b9099;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;">Total due</td>
        <td style="padding:9px 14px;font-size:16px;font-weight:800;color:#c8102e;">${totalStr}</td>
      </tr>`;
    invoiceCta = `<a href="${invUrl}" style="display:inline-block;margin-left:10px;background:#ffffff;color:#c8102e;text-decoration:none;font-weight:700;font-size:15px;padding:11px 20px;border-radius:8px;border:1px solid #c8102e;">View invoice →</a>`;
    invoiceLine = ` An invoice (${job.invoice.invoiceNumber}, ${totalStr}) is attached to this record.`;
  }

  const html = shell({
    heading: "Work order completed",
    tint: "#1e7a46",
    bodyRows: unitRows(job) + invoiceRows,
    ctaLabel: "Download certificate →",
    ctaHref: certUrl,
    ctaExtra: invoiceCta,
    footnote:
      `Both PSI and the operator have signed. A dual-signed certificate has been issued for your records.${invoiceLine} This notice was sent to ${toEmail}.`,
  });
  return { subject, preview, html, toName, toEmail, signToken: null };
}

async function dispatch(jobId: string, type: string) {
  const job = (await prisma.turnaroundJob.findUnique({
    where: { id: jobId },
    include: {
      fluidEnd: true,
      signatures: true,
      invoice: { include: { items: { orderBy: { order: "asc" } } } },
    },
  })) as JobForEmail | null;
  if (!job) return;

  const base = appBaseUrl();
  const built =
    type === NOTIFY_TYPE.COMPLETED ? buildCompletedEmail(job, base) : buildSignRequestEmail(job, base);

  // Deliver via the configured mailer (mock records; resend actually sends).
  const msg: EmailMessage = {
    toName: built.toName,
    toEmail: built.toEmail,
    subject: built.subject,
    html: built.html,
  };
  const result = await getMailer().send(msg).catch(() => ({ ok: false }));

  await prisma.notification.create({
    data: {
      jobId: job.id,
      recipient: PARTY.PRO_PETRO,
      type,
      subject: built.subject,
      preview: built.preview,
      emailHtml: built.html,
      toName: built.toName,
      toEmail: built.toEmail,
      signToken: built.signToken,
      emailedAt: result.ok ? new Date() : null,
    },
  });
}

/** PSI has signed; ask the operator (Pro Petro) to countersign. */
export function notifyOperatorSignRequest(jobId: string) {
  return dispatch(jobId, NOTIFY_TYPE.SIGN_REQUEST);
}

/** Both parties signed; tell the operator the certificate is ready. */
export function notifyOperatorCompleted(jobId: string) {
  return dispatch(jobId, NOTIFY_TYPE.COMPLETED);
}
