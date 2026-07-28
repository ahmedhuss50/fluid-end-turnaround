import { STATUS_LABEL } from "@/lib/constants";

export function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "COMPLETED"
      ? "completed"
      : status === "DRAFT"
      ? "draft"
      : "awaiting";
  return (
    <span className={`badge ${cls}`}>
      <span className="d" />
      {STATUS_LABEL[status] || status}
    </span>
  );
}

export function ResultBadge({ result }: { result: string }) {
  const pass = result === "PASS";
  return <span className={`badge ${pass ? "pass" : "fail"}`}>{pass ? "Pass" : "Fail"}</span>;
}

export function SignBadge({ signed }: { signed: boolean }) {
  return (
    <span className={`badge ${signed ? "signed" : "pending"}`}>
      {signed ? "Signed" : "Pending"}
    </span>
  );
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
