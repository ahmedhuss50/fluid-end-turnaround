import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getRole } from "@/lib/role";
import { DELIVERY_LABEL } from "@/lib/constants";
import { StatusBadge, fmtDate } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function BatchDetail({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { submitted?: string };
}) {
  const isClient = getRole() === "client";
  const batch = await prisma.requestBatch.findUnique({
    where: { id: params.id },
    include: { items: { orderBy: { order: "asc" } } },
  });
  if (!batch) notFound();

  const job = batch.jobId
    ? await prisma.turnaroundJob.findUnique({ where: { id: batch.jobId }, include: { fluidEnd: true } })
    : null;
  const converted = batch.status === "CONVERTED";

  return (
    <>
      <div className="page-head">
        <div>
          <p className="crumb"><Link href="/requests">Repair requests</Link> / {batch.batchNumber}</p>
          <h1 className="mono" style={{ fontSize: 22 }}>{batch.batchNumber}</h1>
          <p>Batch of {batch.items.length} fluid ends · {batch.company}</p>
        </div>
        {!isClient && !converted && (
          <Link href={`/jobs/new-batch?batchId=${batch.id}`} className="btn">Start combined work order →</Link>
        )}
        {converted && job && (
          <Link href={`/jobs/${job.id}`} className="btn secondary">View work order {job.jobNumber} →</Link>
        )}
      </div>

      {searchParams.submitted === "1" && (
        <div className="callout green" style={{ marginBottom: 18 }}>
          <span><strong>Batch submitted.</strong> All {batch.items.length} units are authorized and ready for PSI to start one combined work order.</span>
        </div>
      )}

      <div className="card" style={{ marginBottom: 22 }}>
        <div className="card-head">
          <h2>Batch details</h2>
          {converted
            ? <span className="badge completed"><span className="d" />Work order created</span>
            : <span className="badge awaiting"><span className="d" />Awaiting work order</span>}
        </div>
        <div className="card-body">
          <dl className="kv">
            <dt>Company / operator</dt><dd>{batch.company}</dd>
            <dt>Contact</dt><dd>{batch.contactName}{batch.contactEmail ? ` · ${batch.contactEmail}` : ""}</dd>
            <dt>Authorized by</dt><dd>{batch.clientSignerName}{batch.clientSignerTitle ? ` · ${batch.clientSignerTitle}` : ""}</dd>
            <dt>Authorized at</dt><dd>{fmtDate(batch.clientSignedAt)}</dd>
            <dt>Delivery method</dt><dd>{batch.deliveryMethod ? DELIVERY_LABEL[batch.deliveryMethod] || batch.deliveryMethod : "—"}</dd>
            {batch.notes && (<><dt>Notes</dt><dd>{batch.notes}</dd></>)}
            {job && (<><dt>Work order</dt><dd><Link href={`/jobs/${job.id}`} className="mono">{job.jobNumber}</Link> <StatusBadge status={job.status} /></dd></>)}
          </dl>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Fluid ends in this batch ({batch.items.length})</h2></div>
        <table className="grid">
          <thead>
            <tr><th>#</th><th>Serial #</th><th>Manufacturer</th><th>Model</th><th>Problem / reason</th></tr>
          </thead>
          <tbody>
            {batch.items.map((it, i) => (
              <tr key={it.id}>
                <td className="small muted">{i + 1}</td>
                <td className="mono">{it.serialNumber}</td>
                <td>{it.manufacturer}</td>
                <td className="small">{it.model || "—"}</td>
                <td className="small">{it.problem || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
