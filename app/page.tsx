import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { JOB_STATUS, REQUEST_STATUS } from "@/lib/constants";
import { getRole } from "@/lib/role";
import { StatusBadge, ResultBadge, fmtDate } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  // The dashboard is PSI-facing; clients land on their requests.
  if (getRole() === "client") redirect("/requests");
  const [jobs, counts, openRequests] = await Promise.all([
    prisma.turnaroundJob.findMany({
      orderBy: { createdAt: "desc" },
      include: { fluidEnd: true, pressureTest: true },
      take: 50,
    }),
    prisma.turnaroundJob.groupBy({ by: ["status"], _count: true }),
    prisma.repairRequest.findMany({
      where: { status: REQUEST_STATUS.SUBMITTED },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
  ]);

  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count]));
  const inProgress =
    (byStatus[JOB_STATUS.AWAITING_PSI] || 0) +
    (byStatus[JOB_STATUS.AWAITING_OPERATOR] || 0) +
    (byStatus[JOB_STATUS.DRAFT] || 0);
  const completed = byStatus[JOB_STATUS.COMPLETED] || 0;

  const now = new Date();
  const thisMonth = jobs.filter(
    (j) =>
      j.createdAt.getUTCFullYear() === now.getUTCFullYear() &&
      j.createdAt.getUTCMonth() === now.getUTCMonth()
  ).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Turnaround dashboard</h1>
          <p>Digital turnaround records with dual PSI + operator sign-off.</p>
        </div>
        <Link href="/jobs/new" className="btn">+ New work order</Link>
      </div>

      <div className="stat-row">
        <div className="stat accent">
          <div className="k">Awaiting requests</div><div className="v">{openRequests.length}</div><div className="sub">need a work order</div>
        </div>
        <div className="stat">
          <div className="k">This month</div><div className="v">{thisMonth}</div><div className="sub">of ~30 est. / month</div>
        </div>
        <div className="stat">
          <div className="k">In progress</div><div className="v">{inProgress}</div><div className="sub">drafts &amp; awaiting sign-off</div>
        </div>
        <div className="stat">
          <div className="k">Completed</div><div className="v">{completed}</div><div className="sub">fully signed</div>
        </div>
      </div>

      {openRequests.length > 0 && (
        <div className="card" style={{ marginBottom: 22 }}>
          <div className="card-head">
            <h2>Awaiting work order</h2>
            <Link href="/requests" className="small">All requests →</Link>
          </div>
          <table className="grid">
            <thead>
              <tr>
                <th>Request</th>
                <th>Company</th>
                <th>Serial #</th>
                <th>Authorized by</th>
                <th>Submitted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {openRequests.map((r) => {
                const params = new URLSearchParams({
                  serial: r.serialNumber,
                  manufacturer: r.manufacturer,
                  customer: r.company,
                  opName: r.contactName,
                  notes: `Repair request ${r.requestNumber}: ${r.problem}`,
                  requestId: r.id,
                  deliveryMethod: r.deliveryMethod || "",
                }).toString();
                return (
                  <tr key={r.id}>
                    <td className="mono">{r.requestNumber}</td>
                    <td>{r.company}</td>
                    <td className="mono">{r.serialNumber}</td>
                    <td>{r.clientSignerName}</td>
                    <td className="small muted">{fmtDate(r.createdAt)}</td>
                    <td className="right"><Link href={`/jobs/new?${params}`} className="btn secondary small">Start work order →</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <div className="card-head"><h2>Recent turnarounds</h2></div>
        {jobs.length === 0 ? (
          <div className="empty">
            <span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 15h6M9 11h2"/></svg></span>
            <div className="big">No turnarounds yet</div>
            <div>Create your first digital turnaround record to get started.</div>
            <div className="mt"><Link href="/jobs/new" className="btn">+ New work order</Link></div>
          </div>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>Job</th>
                <th>Serial #</th>
                <th>Customer</th>
                <th>Technician</th>
                <th>Test</th>
                <th>Status</th>
                <th>Intake</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td><Link href={`/jobs/${j.id}`} className="mono">{j.jobNumber}</Link></td>
                  <td className="mono">{j.fluidEnd.serialNumber}</td>
                  <td>{j.fluidEnd.customer}</td>
                  <td>{j.technician}</td>
                  <td>{j.pressureTest ? <ResultBadge result={j.pressureTest.result} /> : "—"}</td>
                  <td><StatusBadge status={j.status} /></td>
                  <td className="small muted">{fmtDate(j.intakeDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
