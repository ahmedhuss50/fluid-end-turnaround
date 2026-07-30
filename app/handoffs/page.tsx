import Link from "next/link";
import { prisma } from "@/lib/db";
import { getRole } from "@/lib/role";
import { HANDOFF_STATUS } from "@/lib/constants";
import { fmtDate } from "@/components/ui";
import ReleaseForm from "@/components/ReleaseForm";
import { CUSTOMERS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function Handoffs({ searchParams }: { searchParams: { released?: string } }) {
  const isClient = getRole() === "client";
  const [handoffs, openRequests] = await Promise.all([
    prisma.handoff.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    isClient
      ? prisma.repairRequest.findMany({
          where: { status: "SUBMITTED" },
          orderBy: { createdAt: "desc" },
          select: { id: true, requestNumber: true, serialNumber: true, manufacturer: true, company: true, deliveryMethod: true, problem: true },
        })
      : Promise.resolve([]),
  ]);

  const requestOptions = openRequests.map((r) => ({
    id: r.id, requestNumber: r.requestNumber, serialNumber: r.serialNumber,
    manufacturer: r.manufacturer, customer: r.company, deliveryMethod: r.deliveryMethod, problem: r.problem,
  }));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Release &amp; receive</h1>
          <p>Chain of custody for a fluid end: the client signs to release it, PSI signs to receive it.</p>
        </div>
      </div>

      {searchParams.released === "1" && (
        <div className="callout green" style={{ marginBottom: 18 }}>
          <span><strong>Released.</strong> The handoff is recorded and awaiting PSI&apos;s receipt signature.</span>
        </div>
      )}

      {isClient && (
        <>
          <div className="card" style={{ marginBottom: 22 }}>
            <div className="card-head"><h2>Release a fluid end</h2></div>
            <div className="card-body" style={{ paddingBottom: 0 }}>
              <p className="hint" style={{ marginTop: -4 }}>Fill in the unit details, then sign to release it to PSI.</p>
            </div>
          </div>
          <ReleaseForm customer={CUSTOMERS[0]} requests={requestOptions} />
        </>
      )}

      <div className="card">
        <div className="card-head"><h2>{isClient ? "Your handoffs" : "Handoffs"}</h2></div>
        {handoffs.length === 0 ? (
          <div className="empty">
            <div className="big">No handoffs yet</div>
            <div>{isClient ? "Release a fluid end above to start the chain of custody." : "Client releases will appear here for PSI to receive."}</div>
          </div>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>Handoff</th>
                <th>Serial #</th>
                <th>Customer</th>
                <th>Released by</th>
                <th>Received by</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {handoffs.map((h) => (
                <tr key={h.id}>
                  <td className="mono">{h.handoffNumber}</td>
                  <td className="mono">{h.serialNumber}</td>
                  <td>{h.customer}</td>
                  <td>{h.releasedByName}<div className="small muted">{fmtDate(h.releasedAt)}</div></td>
                  <td>{h.receivedByName || <span className="muted">—</span>}</td>
                  <td>
                    {h.status === HANDOFF_STATUS.RECEIVED
                      ? <span className="badge completed">Received</span>
                      : <span className="badge awaiting">Awaiting receipt</span>}
                  </td>
                  <td className="right">
                    {!isClient && h.status === HANDOFF_STATUS.RELEASED
                      ? <Link href={`/handoffs/${h.id}`} className="btn secondary small">Receive →</Link>
                      : <Link href={`/handoffs/${h.id}`} className="small">View →</Link>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
