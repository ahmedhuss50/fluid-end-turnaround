import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { applySignature } from "@/app/actions";
import { PARTY, PARTY_LABEL, PART_LABEL } from "@/lib/constants";
import { ResultBadge, fmtDate } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SignPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { done?: string };
}) {
  const sig = await prisma.signature.findUnique({
    where: { token: params.token },
    include: {
      job: { include: { fluidEnd: true, pressureTest: true, signatures: true } },
    },
  });
  if (!sig) notFound();

  const job = sig.job;
  const parts: string[] = safeParse(job.replacedParts);
  const done = searchParams.done === "1" || sig.status === "SIGNED";

  const priorPending = job.signatures.find(
    (s) => s.order < sig.order && s.status !== "SIGNED"
  );

  return (
    <div className="signbox">
      <div className="sign-doc">
        <div className="band">Fluid End Work Order — {job.jobNumber}</div>
        <div className="card-body">
          <dl className="kv">
            <dt>Serial number</dt><dd className="mono">{job.fluidEnd.serialNumber}</dd>
            <dt>Manufacturer</dt><dd>{job.fluidEnd.manufacturer}</dd>
            <dt>Customer</dt><dd>{job.fluidEnd.customer}</dd>
            <dt>Technician</dt><dd>{job.technician}</dd>
            <dt>Intake</dt><dd>{fmtDate(job.intakeDate)}</dd>
            <dt>Parts</dt><dd>{parts.length ? parts.map((p) => PART_LABEL[p] || p).join(", ") : "None recorded"}</dd>
            <dt>Pressure test</dt>
            <dd>
              {job.pressureTest ? (
                <>
                  <ResultBadge result={job.pressureTest.result} />{" "}
                  {job.pressureTest.testPressurePsi.toLocaleString()} psi · {job.pressureTest.holdTimeMinutes} min
                </>
              ) : "—"}
            </dd>
          </dl>

          <hr style={{ border: "none", borderTop: "1px solid var(--line)", margin: "18px 0" }} />

          <div className="section-label" style={{ color: "var(--ink-2)" }}>
            {PARTY_LABEL[sig.party]} signature
          </div>

          {done ? (
            <div className="callout green">
              <strong>Signed.</strong> Thank you, {sig.signerName}. Your signature has been recorded
              {sig.party === PARTY.PRO_PETRO ? " and the certificate has been issued." : "."}
              <div style={{ marginTop: 10 }}>
                <Link href={`/jobs/${job.id}`} className="btn secondary small">View work order record →</Link>
              </div>
            </div>
          ) : priorPending ? (
            <div className="callout amber">
              This document is waiting on the <strong>PSI signature</strong> before {PARTY_LABEL[sig.party]} can sign.
            </div>
          ) : (
            <form action={applySignature.bind(null, params.token)}>
              <div className="field">
                <label>Type your full name to sign as {PARTY_LABEL[sig.party]} <span className="req">*</span></label>
                <input
                  type="text"
                  name="typedName"
                  required
                  defaultValue={sig.signerName}
                  className="sig-input"
                  autoComplete="off"
                />
                <div className="hint">
                  By typing your name and clicking Sign, you adopt this as your electronic signature.
                  A timestamped audit record is captured.
                </div>
              </div>
              <button type="submit" className="btn green">Sign &amp; accept</button>
            </form>
          )}
        </div>
      </div>
      <p className="small muted" style={{ textAlign: "center", marginTop: 14 }}>
        Fluid End Work Order System · signing via {process.env.ESIGN_PROVIDER || "mock"} provider
      </p>
    </div>
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
