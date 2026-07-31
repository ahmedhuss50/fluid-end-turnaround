import Link from "next/link";
import BatchRequestForm from "@/components/BatchRequestForm";

export const dynamic = "force-dynamic";

export default function NewBatchRequest() {
  return (
    <>
      <div className="page-head">
        <div>
          <p className="crumb"><Link href="/requests">Repair requests</Link> / New batch</p>
          <h1>New batch request</h1>
          <p>Send several fluid ends for repair at once. One authorization covers the whole batch, and PSI works them as a single combined work order.</p>
        </div>
        <Link href="/requests" className="btn secondary">Cancel</Link>
      </div>
      <BatchRequestForm />
    </>
  );
}
