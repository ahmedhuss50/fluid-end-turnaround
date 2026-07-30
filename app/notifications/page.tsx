import { prisma } from "@/lib/db";
import { PARTY } from "@/lib/constants";
import NotificationInbox, { type InboxItem } from "@/components/NotificationInbox";

export const dynamic = "force-dynamic";

/**
 * Operator (Pro Petro) notification inbox. Each row carries the exact email that
 * was dispatched, viewable inline — so the whole "notified by email" flow is
 * demonstrable before a real email account is connected.
 */
export default async function Notifications() {
  const recipient = PARTY.PRO_PETRO;
  const notes = await prisma.notification.findMany({
    where: { recipient },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { job: { select: { jobNumber: true } } },
  });

  const items: InboxItem[] = notes.map((n) => ({
    id: n.id,
    type: n.type,
    subject: n.subject,
    preview: n.preview,
    toName: n.toName,
    toEmail: n.toEmail,
    emailedAt: n.emailedAt ? n.emailedAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
    jobNumber: n.job.jobNumber,
    signToken: n.signToken,
    emailHtml: n.emailHtml,
  }));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Notifications</h1>
          <p>Alerts sent to the operator when PSI signs off a work order — with a copy of the email delivered.</p>
        </div>
      </div>
      <NotificationInbox items={items} recipient={recipient} />
    </>
  );
}
