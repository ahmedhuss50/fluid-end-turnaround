import Link from "next/link";
import { prisma } from "@/lib/db";
import { getRole } from "@/lib/role";
import { JOB_STATUS, PARTY, PART_LABEL, OUTCOME_LABEL } from "@/lib/constants";
import { ResultBadge, fmtDate } from "@/components/ui";

export const dynamic = "force-dynamic";

function parts(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/**
 * Operator (Pro Petro) portal view of work orders: the ones waiting on their
 * countersignature, and the ones already completed with a certificate.
 */
export default async function OperatorWorkOrders() {
  const isClient = getRole() === "client";

  const [awaiting, completed] = await Promise.all([
    prisma.turnaroundJob.findMany({
      where: { status: JOB_STATUS.AWAITING_OPERATOR },
      orderBy: { updatedAt: "desc" },
      include: { fluidEnd: true, pressureTest: true, signatures: true },
    }),
    prisma.turnaroundJob.findMany({
      where: { status: JOB_STATUS.COMPLETED },
      orderBy: { completedDate: "desc" },
      include: { fluidEnd: true, pressureTest: true },
      take: 25,
    }),
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Work orders</h1>
          <p>
            {isClient
              ? "Fluid ends PSI has completed and signed. Review the work and add your sign-off to release the certificate."
              : "Operator-facing view: work orders awaiting the operator's countersignature, and completed records."}
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 22 }}>
        <div className="card-head">
          <h2>Awaiting your sign-off</h2>
          {awaiting.length > 0 && <span className="badge awaiting"><span className="d" />{awaiting.length} to review</span>}
        </div>
        {awaiting.length === 0 ? (
          <div className="empty">
            <div className="big">Nothing waiting on you</div>
            <div>When PSI finishes a fluid end and signs off, it lands here for your countersignature.</div>
          </div>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>Work order</th>
                <th>Serial #</th>
                <th>Parts replaced</th>
                <th>Test</th>
                <th>PSI signed</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {awaiting.map((j) => {
                const op = j.signatures.find((s) => s.party === PARTY.PRO_PETRO);
                const psi = j.signatures.find((s) => s.party === PARTY.PSI);
                const p = parts(j.replacedParts);
                return (
                  <tr key={j.id}>
                    <td className="mono">{j.jobNumber}</td>
                    <td className="mono">{j.fluidEnd.serialNumber}</td>
                    <td className="small">{p.length ? p.map((x) => PART_LABEL[x] || x).join(", ") : "—"}</td>
                    <td>{j.pressureTest ? <ResultBadge result={j.pressureTest.result} /> : "—"}</td>
                    <td className="small muted">{psi?.signedAt ? fmtDate(psi.signedAt) : "—"}</td>
                    <td className="right">
                      {op ? (
                        <a href={`/sign/${op.token}`} className="btn small" target="_blank" rel="noopener">
                          Review &amp; sign →
                        </a>
                      ) : (
                        <Link href={`/jobs/${j.id}`} className="small">View →</Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-head"><h2>Completed</h2></div>
        {completed.length === 0 ? (
          <div className="empty"><div>No completed work orders yet.</div></div>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>Work order</th>
                <th>Serial #</th>
                <th>Outcome</th>
                <th>Test</th>
                <th>Completed</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {completed.map((j) => (
                <tr key={j.id}>
                  <td className="mono">{j.jobNumber}</td>
                  <td className="mono">{j.fluidEnd.serialNumber}</td>
                  <td>{j.outcome ? <span className={`badge ${j.outcome === "SCRAP" ? "fail" : "completed"}`}>{OUTCOME_LABEL[j.outcome] || j.outcome}</span> : "—"}</td>
                  <td>{j.pressureTest ? <ResultBadge result={j.pressureTest.result} /> : "—"}</td>
                  <td className="small muted">{fmtDate(j.completedDate)}</td>
                  <td className="right">
                    {j.certificateUrl ? (
                      <a href={j.certificateUrl} className="btn secondary small" target="_blank" rel="noopener">↓ Certificate</a>
                    ) : (
                      <Link href={`/jobs/${j.id}`} className="small">View →</Link>
                    )}
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
