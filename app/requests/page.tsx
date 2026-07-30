import Link from "next/link";
import { prisma } from "@/lib/db";
import { submitRepairRequest } from "@/app/actions";
import { REQUEST_STATUS, CUSTOMERS, DELIVERY_METHOD } from "@/lib/constants";
import { fmtDate } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function RepairRequests({
  searchParams,
}: {
  searchParams: { submitted?: string };
}) {
  const requests = await prisma.repairRequest.findMany({ orderBy: { createdAt: "desc" }, take: 50 });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Repair requests</h1>
          <p>Client-submitted fluid ends awaiting repair. Each request is authorized by the client&apos;s signature, then turned into a work order.</p>
        </div>
      </div>

      {searchParams.submitted === "1" && (
        <div className="callout green" style={{ marginBottom: 18 }}>
          <span><strong>Request submitted.</strong> It&apos;s listed below and ready for PSI to start a work order.</span>
        </div>
      )}

      <form action={submitRepairRequest} className="stack">
        <div className="card">
          <div className="card-head"><h2>Submit a fluid end for repair</h2></div>
          <div className="card-body">
            <div className="section-label">Client &amp; contact</div>
            <div className="grid-2">
              <div className="field">
                <label>Company (fluid-end owner) <span className="req">*</span></label>
                <select name="company" required defaultValue={CUSTOMERS[0]}>
                  {CUSTOMERS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Contact name <span className="req">*</span></label>
                <input type="text" name="contactName" required placeholder="Who to reach about this unit" />
              </div>
            </div>
            <div className="grid-2">
              <div className="field">
                <label>Contact email</label>
                <input type="email" name="contactEmail" placeholder="Optional" />
              </div>
              <div className="field">
                <label>Contact phone</label>
                <input type="text" name="contactPhone" placeholder="Optional" />
              </div>
            </div>

            <div className="section-label" style={{ marginTop: 8 }}>Fluid end &amp; issue</div>
            <div className="grid-2">
              <div className="field">
                <label>Serial number <span className="req">*</span></label>
                <input type="text" name="serialNumber" required placeholder="e.g. FE-2200-00841" />
              </div>
              <div className="field">
                <label>Manufacturer <span className="req">*</span></label>
                <input type="text" name="manufacturer" required placeholder="e.g. SPM / Gardner Denver" />
              </div>
            </div>
            <div className="grid-2">
              <div className="field">
                <label>Model / spec</label>
                <input type="text" name="model" placeholder="Optional" />
              </div>
              <div className="field">
                <label>Requested service</label>
                <input type="text" name="requestedService" placeholder="e.g. Full turnaround, pressure test" />
              </div>
            </div>
            <div className="field">
              <label>How will PSI receive it?</label>
              <select name="deliveryMethod" defaultValue={DELIVERY_METHOD.DELIVERY}>
                <option value={DELIVERY_METHOD.DELIVERY}>We&apos;ll deliver it to PSI</option>
                <option value={DELIVERY_METHOD.PICKUP}>PSI picks it up from us</option>
              </select>
            </div>
            <div className="field">
              <label>Problem / reason for repair <span className="req">*</span></label>
              <textarea name="problem" required placeholder="Describe the symptoms — leaks, washout, failed test, hours in service…" />
            </div>

            <div className="section-label" style={{ marginTop: 8 }}>Client authorization</div>
            <div className="grid-2">
              <div className="field">
                <label>Authorizing signature — type full name <span className="req">*</span></label>
                <input type="text" name="clientSignerName" required className="sig-input" autoComplete="off" placeholder="Client representative" />
              </div>
              <div className="field">
                <label>Title</label>
                <input type="text" name="clientSignerTitle" placeholder="e.g. Field Superintendent" />
              </div>
            </div>
            <div className="callout blue">
              <span>By typing your name you authorize PSI to inspect and repair this fluid end. A timestamped record of this authorization is kept, and PSI &amp; the operator both sign off on completion.</span>
            </div>

            <div className="wrap-actions mt">
              <button type="submit" className="btn">Submit repair request</button>
            </div>
          </div>
        </div>
      </form>

      <div className="card">
        <div className="card-head"><h2>Incoming requests</h2></div>
        {requests.length === 0 ? (
          <div className="empty">
            <div className="big">No repair requests yet</div>
            <div>Submitted requests will appear here for PSI to action.</div>
          </div>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>Request</th>
                <th>Company</th>
                <th>Serial #</th>
                <th>Authorized by</th>
                <th>Submitted</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => {
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
                    <td>
                      {r.clientSignerName}
                      <div className="small muted">{r.clientSignerTitle || "signed"} · {fmtDate(r.clientSignedAt)}</div>
                    </td>
                    <td className="small muted">{fmtDate(r.createdAt)}</td>
                    <td>
                      {r.status === REQUEST_STATUS.CONVERTED
                        ? <span className="badge completed">Work order created</span>
                        : <span className="badge awaiting">Awaiting work order</span>}
                    </td>
                    <td className="right">
                      {r.status === REQUEST_STATUS.CONVERTED && r.jobId
                        ? <Link href={`/jobs/${r.jobId}`} className="small">View work order →</Link>
                        : <Link href={`/jobs/new?${params}`} className="btn secondary small">Start work order →</Link>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
