import Link from "next/link";
import { prisma } from "@/lib/db";
import { getRole } from "@/lib/role";
import { fmtDate } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Units() {
  const isClient = getRole() === "client";
  const units = await prisma.fluidEnd.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { jobs: true } }, jobs: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Fluid ends</h1>
          <p>Every tracked unit, keyed by serial number, with its work order history.</p>
        </div>
        {!isClient && <Link href="/jobs/new" className="btn">+ New work order</Link>}
      </div>

      <div className="card">
        <div className="card-head"><h2>Tracked units</h2></div>
        {units.length === 0 ? (
          <div className="empty">
            <div className="big">No units yet</div>
            <div>Units are created automatically when you record a work order.</div>
          </div>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>Serial #</th>
                <th>Manufacturer</th>
                <th>Customer</th>
                <th>Work orders</th>
                <th>Last intake</th>
                <th>Tag</th>
              </tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <tr key={u.id}>
                  <td><Link href={`/units/${encodeURIComponent(u.serialNumber)}`} className="mono">{u.serialNumber}</Link></td>
                  <td>{u.manufacturer}</td>
                  <td>{u.customer}</td>
                  <td>{u._count.jobs}</td>
                  <td className="small muted">{u.jobs[0] ? fmtDate(u.jobs[0].intakeDate) : "—"}</td>
                  <td className="small muted">{u.tagId || <span title="Reserved for Phase 2 (RFID/barcode)">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
