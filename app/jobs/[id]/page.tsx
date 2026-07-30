import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { fullJobInclude, appBaseUrl } from "@/lib/jobs";
import { sendForSignatures } from "@/app/actions";
import { JOB_STATUS, PART_LABEL, PARTY, PARTY_LABEL, DELIVERY_LABEL, OUTCOME_LABEL } from "@/lib/constants";
import { StatusBadge, ResultBadge, SignBadge, fmtDate, fmtDateTime } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function JobDetail({ params }: { params: { id: string } }) {
  const job = await prisma.turnaroundJob.findUnique({
    where: { id: params.id },
    include: fullJobInclude(),
  });
  if (!job) notFound();

  const parts: string[] = safeParse(job.replacedParts);
  const base = appBaseUrl();
  const psiSig = job.signatures.find((s) => s.party === PARTY.PSI);
  const opSig = job.signatures.find((s) => s.party === PARTY.PRO_PETRO);
  const isDraft = job.status === JOB_STATUS.DRAFT;
  const isComplete = job.status === JOB_STATUS.COMPLETED;

  return (
    <>
      <div className="page-head">
        <div>
          <p className="small muted"><Link href="/">Dashboard</Link> / {job.jobNumber}</p>
          <h1 className="mono" style={{ fontSize: 22 }}>{job.jobNumber}</h1>
          <div className="flex" style={{ marginTop: 8 }}>
            <StatusBadge status={job.status} />
            {job.pressureTest && <ResultBadge result={job.pressureTest.result} />}
            {job.outcome && (
              <span className={`badge ${job.outcome === "SCRAP" ? "fail" : "completed"}`}>
                {OUTCOME_LABEL[job.outcome] || job.outcome}
              </span>
            )}
          </div>
        </div>
        <div className="wrap-actions">
          {isDraft && (
            <form action={sendForSignatures.bind(null, job.id)}>
              <button type="submit" className="btn">Send for signatures →</button>
            </form>
          )}
          {isComplete && job.certificateUrl && (
            <a href={job.certificateUrl} className="btn green" target="_blank" rel="noopener">
              ↓ Download certificate
            </a>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Unit &amp; work record</h2></div>
        <div className="card-body">
          <dl className="kv">
            <dt>Serial number</dt>
            <dd className="mono">
              <Link href={`/units/${encodeURIComponent(job.fluidEnd.serialNumber)}`}>
                {job.fluidEnd.serialNumber}
              </Link>
            </dd>
            <dt>Manufacturer</dt><dd>{job.fluidEnd.manufacturer}</dd>
            <dt>Customer</dt><dd>{job.fluidEnd.customer}</dd>
            <dt>Model / spec</dt><dd>{job.fluidEnd.model || "—"}</dd>
            <dt>Technician</dt><dd>{job.technician}</dd>
            <dt>Intake date</dt><dd>{fmtDate(job.intakeDate)}</dd>
            <dt>Completed</dt><dd>{fmtDate(job.completedDate)}</dd>
            <dt>Replaced parts</dt>
            <dd>{parts.length ? parts.map((p) => PART_LABEL[p] || p).join(", ") : <span className="muted">None recorded</span>}</dd>
            {job.inspectionNotes && (<><dt>Inspection</dt><dd>{job.inspectionNotes}</dd></>)}
            {job.notes && (<><dt>Work notes</dt><dd>{job.notes}</dd></>)}
          </dl>
        </div>
      </div>

      {(job.deliveryMethod || job.receivedByPsi || job.releasedByClient) && (
        <div className="card">
          <div className="card-head"><h2>Receiving — chain of custody</h2></div>
          <div className="card-body">
            <dl className="kv">
              <dt>Delivery method</dt><dd>{job.deliveryMethod ? DELIVERY_LABEL[job.deliveryMethod] || job.deliveryMethod : "—"}</dd>
              <dt>Released by (client)</dt><dd>{job.releasedByClient || "—"}</dd>
              <dt>Received by (PSI)</dt><dd>{job.receivedByPsi || "—"}</dd>
              <dt>Received at</dt><dd>{fmtDateTime(job.receivedAt)}</dd>
            </dl>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head"><h2>Pressure test</h2></div>
        <div className="card-body">
          {job.pressureTest ? (
            <dl className="kv">
              <dt>Result</dt><dd><ResultBadge result={job.pressureTest.result} /></dd>
              <dt>Test pressure</dt><dd>{job.pressureTest.testPressurePsi.toLocaleString()} psi</dd>
              <dt>Hold time</dt><dd>{job.pressureTest.holdTimeMinutes} min</dd>
              <dt>Instrument</dt><dd>{job.pressureTest.gauge || "—"}</dd>
              <dt>Tested by</dt><dd>{job.pressureTest.testedBy}</dd>
              <dt>Tested at</dt><dd>{fmtDateTime(job.pressureTest.testedAt)}</dd>
            </dl>
          ) : (
            <p className="muted">No pressure test recorded.</p>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Dual sign-off</h2></div>
        <div className="card-body">
          {isDraft && (
            <div className="callout amber" style={{ marginBottom: 16 }}>
              This record is a <strong>draft</strong>. Send it for signatures to begin the PSI → operator sign-off.
            </div>
          )}
          <ul className="timeline">
            {[psiSig, opSig].filter(Boolean).map((sig, i) => {
              const s = sig!;
              const signed = s.status === "SIGNED";
              const priorSigned =
                s.order === 1 || (psiSig && psiSig.status === "SIGNED");
              const canSignNow = !isDraft && !signed && priorSigned;
              return (
                <li key={s.id}>
                  <div className={`num ${signed ? "done" : ""}`}>{signed ? "✓" : s.order}</div>
                  <div className="meta">
                    <div className="who">
                      {PARTY_LABEL[s.party]} — {s.signerName} <SignBadge signed={signed} />
                    </div>
                    <div className="sub">
                      {s.signerRole}
                      {s.signerEmail ? ` · ${s.signerEmail}` : ""}
                      {signed && s.signedAt ? ` · signed ${fmtDateTime(s.signedAt)}` : ""}
                    </div>
                    {canSignNow && (
                      <div style={{ marginTop: 8 }}>
                        <a href={`/sign/${s.token}`} className="btn secondary small" target="_blank" rel="noopener">
                          Open signing page →
                        </a>
                        <div className="hint" style={{ marginTop: 6 }}>
                          Signing link (mock provider): <span className="mono">{base}/sign/{s.token}</span>
                        </div>
                      </div>
                    )}
                    {!isDraft && !signed && !priorSigned && (
                      <div className="hint" style={{ marginTop: 6 }}>Waiting on PSI signature first.</div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {isComplete && (
            <div className="callout green" style={{ marginTop: 16 }}>
              <strong>Completed.</strong> Both parties have signed and a certificate has been issued.
              {job.certificateUrl && (
                <> <a href={job.certificateUrl} target="_blank" rel="noopener">Download the signed PDF →</a></>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function safeParse(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
