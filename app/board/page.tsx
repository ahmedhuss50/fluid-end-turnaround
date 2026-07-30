import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { JOB_STATUS, REQUEST_STATUS, OUTCOME_LABEL, STAGE_LABEL } from "@/lib/constants";
import { getRole } from "@/lib/role";
import { advanceStage } from "@/app/actions";
import { StatusBadge, ResultBadge, fmtDate } from "@/components/ui";

export const dynamic = "force-dynamic";

// A job's board column: sent-for-signature or completed jobs sit in Sign-off;
// otherwise it's wherever its stage says.
function columnOf(j: { status: string; stage: string }) {
  if (j.status === JOB_STATUS.COMPLETED || j.status === JOB_STATUS.AWAITING_PSI || j.status === JOB_STATUS.AWAITING_OPERATOR) {
    return "SIGNOFF";
  }
  return j.stage || "INSPECTION";
}

export default async function Board() {
  if (getRole() === "client") redirect("/requests");

  const [requests, jobs] = await Promise.all([
    prisma.repairRequest.findMany({ where: { status: REQUEST_STATUS.SUBMITTED }, orderBy: { createdAt: "desc" } }),
    prisma.turnaroundJob.findMany({ orderBy: { createdAt: "desc" }, include: { fluidEnd: true, pressureTest: true } }),
  ]);

  const stageCols = [
    { key: "INSPECTION", dot: "#b4690e" },
    { key: "WORK", dot: "#2b5bb5" },
    { key: "TEST", dot: "#7a5bd6" },
    { key: "SIGNOFF", dot: "#1e7a46" },
  ];

  const jobCard = (j: (typeof jobs)[number]) => {
    const isDraft = j.status === JOB_STATUS.DRAFT;
    const col = columnOf(j);
    const canMove = isDraft && col !== "SIGNOFF";
    return (
      <div key={j.id} className="board-card">
        <div className="cc-row">
          <Link href={`/jobs/${j.id}`} className="mono">{j.jobNumber}</Link>
          <span className="cc-sub">{fmtDate(j.intakeDate)}</span>
        </div>
        <div className="cc-sub"><span className="mono" style={{ fontWeight: 600 }}>{j.fluidEnd.serialNumber}</span> · {j.fluidEnd.customer}</div>
        <div className="cc-badges">
          <StatusBadge status={j.status} />
          {j.pressureTest && <ResultBadge result={j.pressureTest.result} />}
          {j.outcome && <span className={`badge ${j.outcome === "SCRAP" ? "fail" : "completed"}`}>{OUTCOME_LABEL[j.outcome] || j.outcome}</span>}
        </div>
        <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
          {canMove ? (
            <form action={advanceStage.bind(null, j.id)}>
              <button type="submit" className="btn secondary small">Move →</button>
            </form>
          ) : isDraft && col === "SIGNOFF" ? (
            <Link href={`/jobs/${j.id}`} className="btn secondary small">Send for sign-off →</Link>
          ) : (
            <Link href={`/jobs/${j.id}`} className="small">Open →</Link>
          )}
        </div>
      </div>
    );
  };

  const jobsInCol = (key: string) => jobs.filter((j) => columnOf(j) === key);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Pipeline board</h1>
          <p>Requests become work orders and move down the pipeline: inspection → work → test → sign-off.</p>
        </div>
        <Link href="/jobs/new" className="btn">+ New work order</Link>
      </div>

      <div className="board board-5">
        {/* Column 1 — Unit & receiving (incoming requests) */}
        <div className="board-col">
          <div className="board-col-head">
            <span className="t"><span className="dot" style={{ background: "#9a948a" }} />Unit &amp; receiving</span>
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
                  <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                    <Link href={`/jobs/new?${params}`} className="btn secondary small">Start work order →</Link>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Columns 2-5 — the work-order stages */}
        {stageCols.map((c) => {
          const items = jobsInCol(c.key);
          return (
            <div key={c.key} className="board-col">
              <div className="board-col-head">
                <span className="t"><span className="dot" style={{ background: c.dot }} />{STAGE_LABEL[c.key]}</span>
                <span className="n">{items.length}</span>
              </div>
              {items.length === 0 ? <div className="board-empty">—</div> : items.map(jobCard)}
            </div>
          );
        })}
      </div>
    </>
  );
}
