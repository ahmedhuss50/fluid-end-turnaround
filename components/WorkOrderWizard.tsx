"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { createTurnaround } from "@/app/actions";
import { WEAR_PARTS, CUSTOMERS, DELIVERY_METHOD, OUTCOME } from "@/lib/constants";
import PressureTestField from "@/components/PressureTestField";
import NameplateCapture from "@/components/NameplateCapture";

type Prefill = {
  serial?: string; manufacturer?: string; customer?: string; model?: string;
  opName?: string; notes?: string; requestId?: string; deliveryMethod?: string;
};

const STEPS = ["Unit & receiving", "Inspection", "Work performed", "Pressure test", "Sign-off & outcome"];

export default function WorkOrderWizard({ prefill }: { prefill?: Prefill }) {
  const sp = prefill || {};
  const fromRequest = !!sp.requestId;
  const [step, setStep] = useState(0);
  const [err, setErr] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const last = STEPS.length - 1;

  const val = (name: string) => {
    const el = formRef.current?.elements.namedItem(name) as HTMLInputElement | null;
    return (el?.value || "").trim();
  };

  function next() {
    if (step === 0 && (!val("serialNumber") || !val("manufacturer"))) {
      setErr("Enter at least the serial number and manufacturer.");
      return;
    }
    if (step === 2 && !val("technician")) {
      setErr("Enter the PSI technician who performed the work.");
      return;
    }
    setErr("");
    setStep((s) => Math.min(s + 1, last));
  }
  function back() { setErr(""); setStep((s) => Math.max(s - 1, 0)); }
  const show = (n: number) => ({ display: step === n ? "block" : "none" });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>New work order</h1>
          <p>Step {step + 1} of {STEPS.length} — {STEPS[step]}</p>
        </div>
        <Link href="/" className="btn secondary">Cancel</Link>
      </div>

      {/* Stepper */}
      <div style={{ display: "flex", gap: 8, marginBottom: 22, flexWrap: "wrap" }}>
        {STEPS.map((s, i) => {
          const state = i === step ? "active" : i < step ? "done" : "todo";
          return (
            <div key={s} onClick={() => i < step && setStep(i)}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 999,
                border: "1px solid", cursor: i < step ? "pointer" : "default",
                borderColor: state === "active" ? "var(--red)" : state === "done" ? "#c4e6d1" : "var(--line)",
                background: state === "active" ? "var(--red-bg)" : state === "done" ? "var(--green-bg)" : "#fff",
                color: state === "active" ? "var(--red-dark)" : state === "done" ? "var(--green)" : "var(--muted)",
                fontSize: 13, fontWeight: 600,
              }}>
              <span style={{
                width: 20, height: 20, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, color: "#fff",
                background: state === "active" ? "var(--red)" : state === "done" ? "var(--green)" : "#c9c1b3",
              }}>{state === "done" ? "✓" : i + 1}</span>
              {s}
            </div>
          );
        })}
      </div>

      <form action={createTurnaround} ref={formRef} className="stack">
        {fromRequest && <input type="hidden" name="requestId" value={sp.requestId} />}

        <div className="card">
          <div className="card-body">
            {/* STEP 0 — Unit & receiving */}
            <div style={show(0)}>
              {fromRequest && (
                <div className="callout blue" style={{ marginBottom: 18 }}>
                  <span>Started from a client repair request — details are pre-filled and the client&apos;s authorization is on file.</span>
                </div>
              )}
              <div className="section-label">Unit identity</div>
              <NameplateCapture />
              <div className="grid-2">
                <div className="field">
                  <label>Serial number <span className="req">*</span></label>
                  <input type="text" name="serialNumber" placeholder="e.g. FE-2200-00841" defaultValue={sp.serial || ""} />
                </div>
                <div className="field">
                  <label>Manufacturer <span className="req">*</span></label>
                  <input type="text" name="manufacturer" placeholder="e.g. SPM / Gardner Denver" defaultValue={sp.manufacturer || ""} />
                </div>
              </div>
              <div className="grid-2">
                <div className="field">
                  <label>Customer / operator <span className="req">*</span></label>
                  <select name="customer" defaultValue={sp.customer || CUSTOMERS[0]}>
                    {CUSTOMERS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Model / spec</label>
                  <input type="text" name="model" placeholder="Optional" defaultValue={sp.model || ""} />
                </div>
              </div>

              <div className="section-label" style={{ marginTop: 10 }}>Receiving — chain of custody</div>
              <div className="field">
                <label>How PSI received it</label>
                <select name="deliveryMethod" defaultValue={sp.deliveryMethod || DELIVERY_METHOD.DELIVERY}>
                  <option value={DELIVERY_METHOD.DELIVERY}>Client delivered to PSI</option>
                  <option value={DELIVERY_METHOD.PICKUP}>PSI picked up</option>
                </select>
              </div>
              <div className="grid-2">
                <div className="field">
                  <label>Released / authorized by (client) — sign</label>
                  <input type="text" name="releasedByClient" className="sig-input" autoComplete="off" placeholder="Client representative" defaultValue={sp.opName || ""} />
                </div>
                <div className="field">
                  <label>Received by (PSI) — sign</label>
                  <input type="text" name="receivedByPsi" className="sig-input" autoComplete="off" placeholder="PSI technician taking possession" />
                </div>
              </div>
            </div>

            {/* STEP 1 — Inspection */}
            <div style={show(1)}>
              <div className="section-label">Inspection</div>
              <div className="field">
                <label>Incoming inspection findings</label>
                <textarea name="inspectionNotes" placeholder="Condition on arrival — bore wear, washout, cracks, seat/valve condition, anything noteworthy…" />
                <div className="hint">Recorded on the work order as the inspection stage.</div>
              </div>
            </div>

            {/* STEP 2 — Work performed */}
            <div style={show(2)}>
              <div className="section-label">Work performed</div>
              <div className="field">
                <label>PSI technician <span className="req">*</span></label>
                <input type="text" name="technician" placeholder="Name of the tech who performed the work" />
              </div>
              <div className="field">
                <label>Replaced wear parts</label>
                <div className="checks">
                  {WEAR_PARTS.map((p) => (
                    <label className="check" key={p.key}>
                      <input type="checkbox" name="parts" value={p.key} /> {p.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>Work notes</label>
                <textarea name="notes" placeholder="What was done during the rebuild…" defaultValue={sp.notes || ""} />
              </div>
            </div>

            {/* STEP 3 — Pressure test */}
            <div style={show(3)}>
              <div className="section-label">Pressure test</div>
              <p className="hint" style={{ marginTop: -8, marginBottom: 14 }}>
                Run the live test — the achieved pressure, hold time, and result fill in automatically (and stay editable).
              </p>
              <PressureTestField />
              <div className="grid-2">
                <div className="field">
                  <label>Instrument / transducer</label>
                  <input type="text" name="gauge" placeholder="e.g. Transducer #4" />
                </div>
                <div className="field">
                  <label>Tested by</label>
                  <input type="text" name="testedBy" placeholder="Defaults to the technician" />
                </div>
              </div>
            </div>

            {/* STEP 4 — Sign-off & outcome */}
            <div style={show(4)}>
              <div className="section-label">Outcome</div>
              <div className="field">
                <label>Work order outcome</label>
                <select name="outcome" defaultValue={OUTCOME.READY_DELIVERY}>
                  <option value={OUTCOME.READY_DELIVERY}>Ready for delivery</option>
                  <option value={OUTCOME.READY_PICKUP}>Ready for pickup</option>
                  <option value={OUTCOME.SCRAP}>Scrap — cannot repair</option>
                </select>
              </div>

              <div className="section-label" style={{ marginTop: 10 }}>Signers (dual sign-off)</div>
              <div className="grid-2">
                <div className="field">
                  <label>PSI signer name</label>
                  <input type="text" name="psiName" placeholder="Defaults to the technician" />
                </div>
                <div className="field">
                  <label>PSI signer email</label>
                  <input type="email" name="psiEmail" placeholder="Optional" />
                </div>
              </div>
              <div className="grid-2">
                <div className="field">
                  <label>Operator (Pro Petro) signer name</label>
                  <input type="text" name="opName" placeholder="Field / QA representative" defaultValue={sp.opName || ""} />
                </div>
                <div className="field">
                  <label>Operator signer email</label>
                  <input type="email" name="opEmail" placeholder="Optional" />
                </div>
              </div>
              <div className="callout blue">
                <span>PSI signs first, then the operator accepts. When both have signed, a tamper-evident PDF certificate is issued automatically.</span>
              </div>
            </div>

            {err && <div className="callout amber" style={{ marginTop: 16 }}><span>{err}</span></div>}

            <div className="wrap-actions mt" style={{ justifyContent: "space-between" }}>
              <div>{step > 0 && <button type="button" className="btn secondary" onClick={back}>← Back</button>}</div>
              <div className="wrap-actions">
                {step < last && <button type="button" className="btn" onClick={next}>Next →</button>}
                {step === last && <button type="submit" className="btn">Create work order</button>}
              </div>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
