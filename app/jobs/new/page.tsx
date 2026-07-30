import WorkOrderWizard from "@/components/WorkOrderWizard";

export default function NewWorkOrder({
  searchParams,
}: {
  searchParams: { serial?: string; manufacturer?: string; customer?: string; model?: string; opName?: string; notes?: string; requestId?: string; deliveryMethod?: string };
}) {
  return <WorkOrderWizard prefill={searchParams || {}} />;
}
