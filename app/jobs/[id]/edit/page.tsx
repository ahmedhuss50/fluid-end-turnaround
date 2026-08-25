import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getRole } from "@/lib/role";
import { PARTY, JOB_STATUS } from "@/lib/constants";
import WorkOrderWizard from "@/components/WorkOrderWizard";

export const dynamic = "force-dynamic";

export default async function EditWorkOrder({ params }: { params: { id: string } }) {
  if (getRole() === "client") redirect("/requests");

  const job = await prisma.turnaroundJob.findUnique({
    where: { id: params.id },
    include: { fluidEnd: true, extraUnits: { orderBy: { order: "asc" } }, signatures: true },
  });
  if (!job) notFound();
  // Only drafts are editable in the wizard.
  if (job.status !== JOB_STATUS.DRAFT) redirect(`/jobs/${job.id}`);

  const psi = job.signatures.find((s) => s.party === PARTY.PSI);
  const op = job.signatures.find((s) => s.party === PARTY.PRO_PETRO);
  let parts: string[] = [];
  try {
    const v = JSON.parse(job.replacedParts);
    if (Array.isArray(v)) parts = v;
  } catch {
    /* ignore */
  }

  return (
    <WorkOrderWizard
      prefill={{
        draftId: job.id,
        serial: job.fluidEnd.serialNumber,
        manufacturer: job.fluidEnd.manufacturer,
        customer: job.fluidEnd.customer,
        model: job.fluidEnd.model || "",
        technician: job.technician,
        inspectionNotes: job.inspectionNotes || "",
        notes: job.notes || "",
        outcome: job.outcome || "",
        parts,
        deliveryMethod: job.deliveryMethod || "",
        receivedByPsi: job.receivedByPsi || "",
        releasedByClient: job.releasedByClient || "",
        psiName: psi?.signerName || "",
        psiEmail: psi?.signerEmail || "",
        opName: op && op.signerName !== "Operator Representative" ? op.signerName : "",
        opEmail: op?.signerEmail || "",
        extras: job.extraUnits.map((u) => ({ serialNumber: u.serialNumber, manufacturer: u.manufacturer, model: u.model || "" })),
      }}
    />
  );
}
