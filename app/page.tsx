import Link from "next/link";
import { prisma } from "@/lib/db";
import { JOB_STATUS } from "@/lib/constants";
import { StatusBadge, ResultBadge, fmtDate } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const [jobs, unitCount, counts] = await Promise.all([
    prisma.turnaroundJob.findMany({
      orderBy: { createdAt: "desc" },
      include: { fluidEnd: true, pressureTest: true },
      take: 50,
    }),
    prisma.fluidEnd.count(),
    prisma.turnaroundJob.groupBy({ by: ["status"], _count: true }),
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
        <Link href="/jobs/new" className="btn">+ New turnaround</Link>
      </div>

      <div className="stat-row">
        <div className="stat"><div className="k">This month</div><div className="v">{thisMonth}<small> / ~30 est.</small></div></div>
        <div className="stat"><div className="k">In progress</div><div className="v">{inProgress}</div></div>
        <div className="stat"><div className="k">Completed</div><div className="v">{completed}</div></div>
        <div className="stat"><div className="k">Fluid ends tracked</div><div className="v">{unitCount}</div></div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Recent turnarounds</h2></div>
        {jobs.length === 0 ? (
          <div className="empty">
            <div className="big">No turnarounds yet</div>
            <div>Create your first digital turnaround record to get started.</div>
            <div className="mt"><Link href="/jobs/new" className="btn">+ New turnaround</Link></div>
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
