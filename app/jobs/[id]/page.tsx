import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { fullJobInclude, appBaseUrl } from "@/lib/jobs";
import { sendForSignatures } from "@/app/actions";
import { getRole } from "@/lib/role";
import { JOB_STATUS, PART_LABEL, PARTY, PARTY_LABEL, DELIVERY_LABEL, OUTCOME_LABEL } from "@/lib/constants";
import { fmtMoney, computeTotals } from "@/lib/money";
import { StatusBadge, ResultBadge, SignBadge, fmtDate, fmtDateTime } from "@/components/ui";
import InvoiceEditor from "@/components/InvoiceEditor";

export const dynamic = "force-dynamic";

export default async function JobDetail({ params }: { params: { id: string } }) {
  const job = await prisma.turnaroundJob.findUnique({
    where: { id: params.id },
    include: { ...fullJobInclude(), invoice: { include: { items: { orderBy: { order: "asc" } } } } },
  });
  if (!job) notFound();

  const isClient = getRole() === "client";
  const parts: string[] = safeParse(job.replacedParts);
  const base = appBaseUrl();
  const psiSig = job.signatures.find((s) => s.party === PARTY.PSI);
  const opSig = job.signatures.find((s) => s.party === PARTY.PRO_PETRO);
  const isDraft = job.status === JOB_STATUS.DRAFT;
  const isComplete = job.status === JOB_STATUS.COMPLETED;

  const inv = job.invoice;
  const invTotals = inv ? computeTotals(inv.items, inv.taxRatePct) : null;

  return (
    <>
      <div className="page-head">
        <div>
          <p className="small muted"><Link href="/">Dashboard</Link> / {job.jobNumber}</p>
          <h1 className="mono" style={{ fontSize: 22 }}>{job.jobNumber}</h1>
          <div className="flex" style={{ marginTop: 8 }}>
            <StatusBadge status={job.status} />
            {job.isBatch && <span className="badge awaiting"><span className="d" />Batch · {job.extraUnits.length + 1} units</span>}
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
          {job.nameplatePhotoKey && (
            <div style={{ marginTop: 16 }}>
              <div className="small muted" style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: ".03em", marginBottom: 8 }}>Nameplate photo</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/nameplate/job/${job.id}`} alt="Nameplate" style={{ maxHeight: 220, borderRadius: 10, border: "1px solid var(--line)" }} />
            </div>
          )}
        </div>
      </div>

      {job.isBatch && (
        <div className="card">
          <div className="card-head"><h2>Fluid ends in this batch ({job.extraUnits.length + 1})</h2></div>
          <table className="grid">
            <thead>
              <tr><th>#</th><th>Serial #</th><th>Manufacturer</th><th>Model</th></tr>
            </thead>
            <tbody>
              <tr>
                <td className="small muted">1</td>
                <td><Link href={`/units/${encodeURIComponent(job.fluidEnd.serialNumber)}`} className="mono">{job.fluidEnd.serialNumber}</Link></td>
                <td>{job.fluidEnd.manufacturer}</td>
                <td className="small">{job.fluidEnd.model || "—"}</td>
              </tr>
              {job.extraUnits.map((u, i) => (
                <tr key={u.id}>
                  <td className="small muted">{i + 2}</td>
                  <td><Link href={`/units/${encodeURIComponent(u.serialNumber)}`} className="mono">{u.serialNumber}</Link></td>
                  <td>{u.manufacturer}</td>
                  <td className="small">{u.model || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
        <div className="card-head">
          <h2>Invoice</h2>
          {inv && (
            <span className={`badge ${inv.status === "ISSUED" ? "completed" : "draft"}`}>
              <span className="d" />{inv.status === "ISSUED" ? "Issued" : "Draft"}
            </span>
          )}
        </div>
        <div className="card-body">
          {isClient ? (
            inv && inv.status === "ISSUED" ? (
              <>
                <dl className="kv">
                  <dt>Invoice #</dt><dd className="mono">{inv.invoiceNumber}</dd>
                  <dt>Issued</dt><dd>{fmtDate(inv.issuedAt)}</dd>
                  <dt>Terms</dt><dd>{inv.terms || "Net 30"}</dd>
                  <dt>Total due</dt><dd style={{ fontWeight: 800, color: "var(--red)" }}>{fmtMoney(invTotals!.totalCents, inv.currency)}</dd>
                </dl>
                {inv.pdfUrl && (
                  <div style={{ marginTop: 12 }}>
                    <a href={inv.pdfUrl} className="btn secondary small" target="_blank" rel="noopener">↓ Download invoice PDF</a>
                  </div>
                )}
              </>
            ) : (
              <p className="muted">The invoice will be available here once the work order is completed.</p>
            )
          ) : (
            <>
              {!isComplete && (
                <div className="callout blue" style={{ marginBottom: 16 }}>
                  <span>Enter line items and amounts now. The invoice PDF is issued automatically when the work order completes — or save it as a draft any time.</span>
                </div>
              )}
              <InvoiceEditor
                jobId={job.id}
                invoiceNumber={inv?.invoiceNumber ?? null}
                status={inv?.status ?? "DRAFT"}
                pdfUrl={inv?.pdfUrl ?? null}
                currency={inv?.currency ?? "USD"}
                taxRatePct={inv?.taxRatePct ?? 0}
                terms={inv?.terms ?? "Net 30"}
                poNumber={inv?.poNumber ?? ""}
                notes={inv?.notes ?? ""}
                items={
                  inv && inv.items.length
                    ? inv.items.map((it) => ({
                        description: it.description,
                        quantity: it.quantity,
                        unitPrice: it.unitPriceCents ? (it.unitPriceCents / 100).toFixed(2) : "",
                      }))
                    : job.isBatch
                    ? [
                        { description: `Service — ${job.fluidEnd.serialNumber}`, quantity: 1, unitPrice: "" },
                        ...job.extraUnits.map((u) => ({ description: `Service — ${u.serialNumber}`, quantity: 1, unitPrice: "" })),
                      ]
                    : [
                        { description: "Labor — fluid-end service", quantity: 1, unitPrice: "" },
                        ...parts.map((p) => ({ description: `Replace ${PART_LABEL[p] || p}`, quantity: 1, unitPrice: "" })),
                      ]
                }
              />
            </>
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
