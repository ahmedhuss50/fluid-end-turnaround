import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getRole } from "@/lib/role";
import BatchWorkOrderWizard from "@/components/BatchWorkOrderWizard";

export const dynamic = "force-dynamic";

export default async function NewBatchWorkOrder({ searchParams }: { searchParams: { batchId?: string } }) {
  // PSI-only flow.
  if (getRole() === "client") redirect("/requests");
  const batchId = searchParams.batchId;
  if (!batchId) redirect("/requests");

  const batch = await prisma.requestBatch.findUnique({
    where: { id: batchId },
    include: { items: { orderBy: { order: "asc" } } },
  });
  if (!batch) notFound();
  if (batch.status === "CONVERTED" && batch.jobId) redirect(`/jobs/${batch.jobId}`);

  return (
    <BatchWorkOrderWizard
      batchId={batch.id}
      batchNumber={batch.batchNumber}
      company={batch.company}
      contactName={batch.contactName}
      deliveryMethod={batch.deliveryMethod}
      initialUnits={batch.items.map((it) => ({
        serialNumber: it.serialNumber,
        manufacturer: it.manufacturer,
        model: it.model || "",
        problem: it.problem || "",
      }))}
    />
  );
}
