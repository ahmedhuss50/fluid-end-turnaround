import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { StatusBadge, ResultBadge, fmtDate } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function UnitHistory({ params }: { params: { serial: string } }) {
  const serial = decodeURIComponent(params.serial);
  const unit = await prisma.fluidEnd.findUnique({
    where: { serialNumber: serial },
    include: {
      jobs: { orderBy: { createdAt: "desc" }, include: { pressureTest: true } },
    },
  });
  if (!unit) notFound();

  return (
    <>
      <div className="page-head">
        <div>
          <p className="small muted"><Link href="/units">Fluid ends</Link> / {unit.serialNumber}</p>
          <h1 className="mono" style={{ fontSize: 22 }}>{unit.serialNumber}</h1>
          <p>{unit.manufacturer} · {unit.customer}{unit.model ? ` · ${unit.model}` : ""}</p>
        </div>
        <Link href="/jobs/new" className="btn">+ New work order</Link>
      </div>

      <div className="card">
        <div className="card-head"><h2>Turnaround history ({unit.jobs.length})</h2></div>
        {unit.jobs.length === 0 ? (
          <div className="empty"><div className="big">No turnarounds recorded for this unit.</div></div>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>Job</th>
                <th>Technician</th>
                <th>Test</th>
                <th>Status</th>
                <th>Intake</th>
                <th>Completed</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {unit.jobs.map((j) => (
                <tr key={j.id}>
                  <td><Link href={`/jobs/${j.id}`} className="mono">{j.jobNumber}</Link></td>
                  <td>{j.technician}</td>
                  <td>{j.pressureTest ? <ResultBadge result={j.pressureTest.result} /> : "—"}</td>
                  <td><StatusBadge status={j.status} /></td>
                  <td className="small muted">{fmtDate(j.intakeDate)}</td>
                  <td className="small muted">{fmtDate(j.completedDate)}</td>
                  <td className="right">
                    {j.certificateUrl && <a href={j.certificateUrl} target="_blank" rel="noopener" className="small">Certificate ↓</a>}
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
