import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getRole } from "@/lib/role";
import { JOB_STATUS, OUTCOME_LABEL, HANDOFF_STATUS, REQUEST_STATUS, DELIVERY_LABEL } from "@/lib/constants";
import { StatusBadge, ResultBadge, fmtDate } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function UnitHistory({ params }: { params: { serial: string } }) {
  const isClient = getRole() === "client";
  const serial = decodeURIComponent(params.serial);

  const unit = await prisma.fluidEnd.findUnique({
    where: { serialNumber: serial },
    include: { jobs: { orderBy: { createdAt: "desc" }, include: { pressureTest: true } } },
  });
  if (!unit) notFound();

  const [handoffs, requests] = await Promise.all([
    prisma.handoff.findMany({ where: { serialNumber: serial }, orderBy: { createdAt: "desc" } }),
    prisma.repairRequest.findMany({ where: { serialNumber: serial }, orderBy: { createdAt: "desc" } }),
  ]);

  const jobs = unit.jobs;
  const completed = jobs.filter((j) => j.status === JOB_STATUS.COMPLETED).length;
  const tested = jobs.filter((j) => j.pressureTest);
  const passes = tested.filter((j) => j.pressureTest?.result === "PASS").length;
  const passRate = tested.length ? `${Math.round((passes / tested.length) * 100)}%` : "—";
  const latest = jobs[0];
  const photoJob = jobs.find((j) => j.nameplatePhotoKey);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="crumb"><Link href="/units">Fluid ends</Link> / {unit.serialNumber}</p>
          <h1 className="mono" style={{ fontSize: 22 }}>{unit.serialNumber}</h1>
          <p>{unit.manufacturer} · {unit.customer}{unit.model ? ` · ${unit.model}` : ""}</p>
        </div>
        {!isClient && <Link href={`/jobs/new?serial=${encodeURIComponent(unit.serialNumber)}&manufacturer=${encodeURIComponent(unit.manufacturer)}&customer=${encodeURIComponent(unit.customer)}`} className="btn">+ New work order</Link>}
      </div>

      <div className="stat-row">
        <div className="stat accent"><div className="k">Turnarounds</div><div className="v">{jobs.length}</div><div className="sub">on record</div></div>
        <div className="stat"><div className="k">Completed</div><div className="v">{completed}</div><div className="sub">signed off</div></div>
        <div className="stat"><div className="k">Pressure-test pass rate</div><div className="v">{passRate}</div><div className="sub">{tested.length} tested</div></div>
        <div className="stat"><div className="k">Last intake</div><div className="v" style={{ fontSize: 20 }}>{latest ? fmtDate(latest.intakeDate) : "—"}</div><div className="sub">{latest ? `latest: ${latest.jobNumber}` : "no jobs yet"}</div></div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Unit details</h2></div>
        <div className="card-body">
          <dl className="kv">
            <dt>Serial number</dt><dd className="mono">{unit.serialNumber}</dd>
            <dt>Manufacturer</dt><dd>{unit.manufacturer}</dd>
            <dt>Customer / operator</dt><dd>{unit.customer}</dd>
            <dt>Model / spec</dt><dd>{unit.model || "—"}</dd>
            <dt>Current status</dt>
            <dd>{latest ? <StatusBadge status={latest.status} /> : <span className="muted">No work orders</span>}</dd>
            <dt>RFID / barcode tag</dt><dd className="muted">— (reserved for Phase 2)</dd>
            <dt>First recorded</dt><dd>{fmtDate(unit.createdAt)}</dd>
          </dl>
          {photoJob && (
            <div style={{ marginTop: 16 }}>
              <div className="small muted" style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: ".03em", marginBottom: 8 }}>Latest nameplate photo</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/nameplate/job/${photoJob.id}`} alt="Nameplate" style={{ maxHeight: 200, borderRadius: 10, border: "1px solid var(--line)" }} />
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Turnaround history ({jobs.length})</h2></div>
        {jobs.length === 0 ? (
          <div className="empty"><div className="big">No turnarounds recorded for this unit.</div></div>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>Job</th><th>Technician</th><th>Test</th><th>Outcome</th><th>Status</th><th>Intake</th><th>Completed</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td><Link href={`/jobs/${j.id}`} className="mono">{j.jobNumber}</Link></td>
                  <td>{j.technician}</td>
                  <td>{j.pressureTest ? <ResultBadge result={j.pressureTest.result} /> : "—"}</td>
                  <td>{j.outcome ? <span className={`badge ${j.outcome === "SCRAP" ? "fail" : "completed"}`}>{OUTCOME_LABEL[j.outcome] || j.outcome}</span> : "—"}</td>
                  <td><StatusBadge status={j.status} /></td>
                  <td className="small muted">{fmtDate(j.intakeDate)}</td>
                  <td className="small muted">{fmtDate(j.completedDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-head"><h2>Chain of custody ({handoffs.length})</h2></div>
        {handoffs.length === 0 ? (
          <div className="empty"><div>No release / receive handoffs for this unit.</div></div>
        ) : (
          <table className="grid">
            <thead>
              <tr><th>Handoff</th><th>Released by</th><th>Received by</th><th>Method</th><th>Status</th><th>Date</th></tr>
            </thead>
            <tbody>
              {handoffs.map((h) => (
                <tr key={h.id}>
                  <td><Link href={`/handoffs/${h.id}`} className="mono">{h.handoffNumber}</Link></td>
                  <td>{h.releasedByName}</td>
                  <td>{h.receivedByName || <span className="muted">—</span>}</td>
                  <td className="small">{h.deliveryMethod ? DELIVERY_LABEL[h.deliveryMethod] || h.deliveryMethod : "—"}</td>
                  <td>{h.status === HANDOFF_STATUS.RECEIVED ? <span className="badge completed">Received</span> : <span className="badge awaiting">Awaiting receipt</span>}</td>
                  <td className="small muted">{fmtDate(h.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-head"><h2>Repair requests ({requests.length})</h2></div>
        {requests.length === 0 ? (
          <div className="empty"><div>No repair requests for this unit.</div></div>
        ) : (
          <table className="grid">
            <thead>
              <tr><th>Request</th><th>Problem</th><th>Authorized by</th><th>Status</th><th>Submitted</th></tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.requestNumber}</td>
                  <td className="small">{r.problem}</td>
                  <td>{r.clientSignerName}</td>
                  <td>{r.status === REQUEST_STATUS.CONVERTED ? <span className="badge completed">Work order created</span> : <span className="badge awaiting">Awaiting work order</span>}</td>
                  <td className="small muted">{fmtDate(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
