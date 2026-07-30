import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getRole } from "@/lib/role";
import { HANDOFF_STATUS, DELIVERY_LABEL } from "@/lib/constants";
import { receiveHandoff } from "@/app/actions";
import { fmtDate, fmtDateTime } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function HandoffDetail({ params }: { params: { id: string } }) {
  const h = await prisma.handoff.findUnique({ where: { id: params.id } });
  if (!h) notFound();
  const isClient = getRole() === "client";
  const received = h.status === HANDOFF_STATUS.RECEIVED;

  const woParams = new URLSearchParams({
    serial: h.serialNumber, manufacturer: h.manufacturer || "", customer: h.customer,
    deliveryMethod: h.deliveryMethod || "",
  }).toString();

  return (
    <>
      <div className="page-head">
        <div>
          <p className="crumb"><Link href="/handoffs">Release &amp; receive</Link> / {h.handoffNumber}</p>
          <h1 className="mono" style={{ fontSize: 22 }}>{h.handoffNumber}</h1>
          <div className="flex" style={{ marginTop: 8 }}>
            {received ? <span className="badge completed">Received by PSI</span> : <span className="badge awaiting">Released — awaiting PSI receipt</span>}
          </div>
        </div>
        {!isClient && received && (
          <Link href={`/jobs/new?${woParams}`} className="btn">Start work order →</Link>
        )}
      </div>

      <div className="card">
        <div className="card-head"><h2>Fluid end</h2></div>
        <div className="card-body">
          <dl className="kv">
            <dt>Serial number</dt><dd className="mono">{h.serialNumber}</dd>
            <dt>Manufacturer</dt><dd>{h.manufacturer || "—"}</dd>
            <dt>Customer</dt><dd>{h.customer}</dd>
            <dt>Delivery method</dt><dd>{h.deliveryMethod ? DELIVERY_LABEL[h.deliveryMethod] || h.deliveryMethod : "—"}</dd>
            {h.conditionNotes && (<><dt>Condition at release</dt><dd>{h.conditionNotes}</dd></>)}
          </dl>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Chain of custody</h2></div>
        <div className="card-body">
          <ul className="timeline">
            <li>
              <div className="num done">✓</div>
              <div className="meta">
                <div className="who">Released by client — {h.releasedByName} <span className="badge signed">Signed</span></div>
                <div className="sub">{h.releasedByTitle ? `${h.releasedByTitle} · ` : ""}{fmtDateTime(h.releasedAt)}</div>
              </div>
            </li>
            <li>
              <div className={`num ${received ? "done" : ""}`}>{received ? "✓" : "2"}</div>
              <div className="meta">
                <div className="who">
                  Received by PSI {received ? `— ${h.receivedByName}` : ""} {received ? <span className="badge signed">Signed</span> : <span className="badge pending">Pending</span>}
                </div>
                <div className="sub">{received ? fmtDateTime(h.receivedAt) : "Awaiting PSI receipt signature"}</div>
              </div>
            </li>
          </ul>

          {!received && !isClient && (
            <form action={receiveHandoff.bind(null, h.id)} style={{ marginTop: 18 }}>
              <div className="section-label">Sign to receive (PSI)</div>
              <div className="field" style={{ maxWidth: 420 }}>
                <label>Received by — type full name <span className="req">*</span></label>
                <input type="text" name="receivedByName" className="sig-input" autoComplete="off" placeholder="PSI technician taking possession" />
                <div className="hint">By signing you confirm PSI has taken possession of this fluid end.</div>
              </div>
              <button type="submit" className="btn green">Sign &amp; receive</button>
            </form>
          )}

          {!received && isClient && (
            <div className="callout amber" style={{ marginTop: 16 }}><span>Waiting on PSI to sign for receipt.</span></div>
          )}
          {received && (
            <div className="callout green" style={{ marginTop: 16 }}><span><strong>Complete.</strong> Both parties have signed — the fluid end is now in PSI&apos;s custody.</span></div>
          )}
        </div>
      </div>
    </>
  );
}
