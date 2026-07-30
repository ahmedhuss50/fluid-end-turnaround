import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { JOB_STATUS, REQUEST_STATUS, OUTCOME_LABEL } from "@/lib/constants";
import { getRole } from "@/lib/role";
import { StatusBadge, ResultBadge, fmtDate } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Board() {
  if (getRole() === "client") redirect("/requests");

  const [requests, jobs] = await Promise.all([
    prisma.repairRequest.findMany({ where: { status: REQUEST_STATUS.SUBMITTED }, orderBy: { createdAt: "desc" } }),
    prisma.turnaroundJob.findMany({ orderBy: { createdAt: "desc" }, include: { fluidEnd: true, pressureTest: true } }),
  ]);

  const inProgress = jobs.filter((j) => j.status !== JOB_STATUS.COMPLETED);
  const completed = jobs.filter((j) => j.status === JOB_STATUS.COMPLETED);

  const jobCard = (j: (typeof jobs)[number]) => (
    <Link key={j.id} href={`/jobs/${j.id}`} className="board-card" style={{ display: "block" }}>
      <div className="cc-row">
        <span className="mono">{j.jobNumber}</span>
        <span className="cc-sub">{fmtDate(j.intakeDate)}</span>
      </div>
      <div className="cc-sub"><span className="mono" style={{ fontWeight: 600 }}>{j.fluidEnd.serialNumber}</span> · {j.fluidEnd.customer}</div>
      <div className="cc-badges">
        <StatusBadge status={j.status} />
        {j.pressureTest && <ResultBadge result={j.pressureTest.result} />}
        {j.outcome && <span className={`badge ${j.outcome === "SCRAP" ? "fail" : "completed"}`}>{OUTCOME_LABEL[j.outcome] || j.outcome}</span>}
      </div>
    </Link>
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Pipeline board</h1>
          <p>Requests move into work orders, through the shop, and out to the operator.</p>
        </div>
        <Link href="/jobs/new" className="btn">+ New work order</Link>
      </div>

      <div className="board">
        {/* Column 1 — Requests / receiving */}
        <div className="board-col">
          <div className="board-col-head">
            <span className="t"><span className="dot" style={{ background: "#b4690e" }} />Requests · receiving</span>
            <span className="n">{requests.length}</span>
          </div>
          {requests.length === 0 ? (
            <div className="board-empty">No incoming requests</div>
          ) : (
            requests.map((r) => {
              const params = new URLSearchParams({
                serial: r.serialNumber, manufacturer: r.manufacturer, customer: r.company,
                opName: r.contactName, notes: `Repair request ${r.requestNumber}: ${r.problem}`,
                requestId: r.id, deliveryMethod: r.deliveryMethod || "",
              }).toString();
              return (
                <div key={r.id} className="board-card">
                  <div className="cc-row">
                    <span className="mono">{r.requestNumber}</span>
                    <span className="cc-sub">{fmtDate(r.createdAt)}</span>
                  </div>
                  <div className="cc-sub"><span className="mono" style={{ fontWeight: 600 }}>{r.serialNumber}</span> · {r.company}</div>
                  <div className="cc-sub" style={{ marginTop: 2 }}>Authorized by {r.clientSignerName}</div>
                  <div style={{ marginTop: 10 }}>
                    <Link href={`/jobs/new?${params}`} className="btn secondary small">Start work order →</Link>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Column 2 — In progress (received → testing → sign-off) */}
        <div className="board-col">
          <div className="board-col-head">
            <span className="t"><span className="dot" style={{ background: "#2b5bb5" }} />In progress</span>
            <span className="n">{inProgress.length}</span>
          </div>
          {inProgress.length === 0 ? <div className="board-empty">Nothing in the shop</div> : inProgress.map(jobCard)}
        </div>

        {/* Column 3 — Completed / ready */}
        <div className="board-col">
          <div className="board-col-head">
            <span className="t"><span className="dot" style={{ background: "#1e7a46" }} />Completed · ready</span>
            <span className="n">{completed.length}</span>
          </div>
          {completed.length === 0 ? <div className="board-empty">None completed yet</div> : completed.map(jobCard)}
        </div>
      </div>
    </>
  );
}
