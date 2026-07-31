"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { createBatchWorkOrder } from "@/app/actions";
import { WEAR_PARTS, DELIVERY_METHOD, OUTCOME } from "@/lib/constants";
import PressureTestField from "@/components/PressureTestField";

type Unit = { serialNumber: string; manufacturer: string; model: string; problem: string };

const STEPS = ["Units & receiving", "Inspection", "Work performed", "Pressure test", "Sign-off & outcome"];

export default function BatchWorkOrderWizard({
  batchId,
  batchNumber,
  company,
  contactName,
  initialUnits,
  deliveryMethod,
}: {
  batchId: string;
  batchNumber: string;
  company: string;
  contactName: string;
  initialUnits: Unit[];
  deliveryMethod?: string | null;
}) {
  const [step, setStep] = useState(0);
  const [err, setErr] = useState("");
  const [units, setUnits] = useState<Unit[]>(initialUnits.length ? initialUnits : [{ serialNumber: "", manufacturer: "", model: "", problem: "" }]);
  const formRef = useRef<HTMLFormElement>(null);
  const last = STEPS.length - 1;

  const setU = (i: number, patch: Partial<Unit>) => setUnits((prev) => prev.map((u, idx) => (idx === i ? { ...u, ...patch } : u)));
  const addUnit = () => setUnits((prev) => [...prev, { serialNumber: "", manufacturer: "", model: "", problem: "" }]);
  const removeUnit = (i: number) => setUnits((prev) => prev.filter((_, idx) => idx !== i));

  const val = (name: string) => {
    const el = formRef.current?.elements.namedItem(name) as HTMLInputElement | null;
    return (el?.value || "").trim();
  };

  function next() {
    if (step === 0 && !units.some((u) => u.serialNumber.trim() && u.manufacturer.trim())) {
      setErr("Each unit needs at least a serial number and manufacturer.");
      return;
    }
    if (step === 2 && !val("technician")) {
      setErr("Enter the PSI technician who performed the work.");
      return;
    }
    setErr("");
    setStep((s) => Math.min(s + 1, last));
  }
  const back = () => { setErr(""); setStep((s) => Math.max(s - 1, 0)); };
  const show = (n: number) => ({ display: step === n ? "block" : "none" });

  return (
    <>
      <div className="page-head">
        <div>
          <p className="crumb"><Link href={`/batches/${batchId}`}>{batchNumber}</Link> / Combined work order</p>
          <h1>New combined work order</h1>
          <p>Step {step + 1} of {STEPS.length} — {STEPS[step]} · {units.length} units · {company}</p>
        </div>
        <Link href={`/batches/${batchId}`} className="btn secondary">Cancel</Link>
      </div>

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
              <span style={{ width: 20, height: 20, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", background: state === "active" ? "var(--red)" : state === "done" ? "var(--green)" : "#c9c1b3" }}>{state === "done" ? "✓" : i + 1}</span>
              {s}
            </div>
          );
        })}
      </div>

      <form action={createBatchWorkOrder} ref={formRef} className="stack">
        <input type="hidden" name="batchId" value={batchId} />

        <div className="card">
          <div className="card-body">
            {/* STEP 0 — Units & receiving */}
            <div style={show(0)}>
              <div className="callout blue" style={{ marginBottom: 18 }}>
                <span>Started from batch <strong>{batchNumber}</strong> — {units.length} fluid ends, authorized by the client. Review the units and add receiving details.</span>
              </div>
              <div className="section-label">Fluid ends in this work order <span className="badge awaiting" style={{ marginLeft: 6 }}>{units.length}</span></div>
              {units.map((u, i) => (
                <div key={i} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 14, marginBottom: 12, background: "#fbfaf7" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span className="small" style={{ fontWeight: 700, color: "var(--ink-2)" }}>Unit {i + 1}</span>
                    {units.length > 1 && <button type="button" className="linkbtn" onClick={() => removeUnit(i)}>✕ Remove</button>}
                  </div>
                  <div className="grid-2">
                    <div className="field">
                      <label>Serial number <span className="req">*</span></label>
                      <input type="text" name="unitSerial" value={u.serialNumber} onChange={(e) => setU(i, { serialNumber: e.target.value })} placeholder="e.g. FE-2200-00841" />
                    </div>
                    <div className="field">
                      <label>Manufacturer <span className="req">*</span></label>
                      <input type="text" name="unitManufacturer" value={u.manufacturer} onChange={(e) => setU(i, { manufacturer: e.target.value })} placeholder="e.g. SPM" />
                    </div>
                  </div>
                  <div className="grid-2">
                    <div className="field">
                      <label>Model / spec</label>
                      <input type="text" name="unitModel" value={u.model} onChange={(e) => setU(i, { model: e.target.value })} placeholder="Optional" />
                    </div>
                    <div className="field">
                      <label>Problem / reason</label>
                      <input type="text" name="unitProblem" value={u.problem} onChange={(e) => setU(i, { problem: e.target.value })} placeholder="Optional" />
                    </div>
                  </div>
                </div>
              ))}
              <div><button type="button" className="btn secondary small" onClick={addUnit}>+ Add unit</button></div>

              <div className="section-label" style={{ marginTop: 14 }}>Receiving — chain of custody (whole batch)</div>
              <div className="field">
                <label>How PSI received them</label>
                <select name="deliveryMethod" defaultValue={deliveryMethod || DELIVERY_METHOD.DELIVERY}>
                  <option value={DELIVERY_METHOD.DELIVERY}>Client delivered to PSI</option>
                  <option value={DELIVERY_METHOD.PICKUP}>PSI picked up</option>
                </select>
              </div>
              <div className="grid-2">
                <div className="field">
                  <label>Released / authorized by (client) — sign</label>
                  <input type="text" name="releasedByClient" className="sig-input" autoComplete="off" placeholder="Client representative" defaultValue={contactName} />
                </div>
                <div className="field">
                  <label>Received by (PSI) — sign</label>
                  <input type="text" name="receivedByPsi" className="sig-input" autoComplete="off" placeholder="PSI technician taking possession" />
                </div>
              </div>
            </div>

            {/* STEP 1 — Inspection */}
            <div style={show(1)}>
              <div className="section-label">Inspection (combined)</div>
              <div className="field">
                <label>Incoming inspection findings</label>
                <textarea name="inspectionNotes" placeholder="Condition on arrival across the batch — note any unit-specific findings here…" />
                <div className="hint">One inspection summary covers the batch; call out individual units by serial as needed.</div>
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
                <label>Replaced wear parts (across the batch)</label>
                <div className="checks">
                  {WEAR_PARTS.map((p) => (
                    <label className="check" key={p.key}><input type="checkbox" name="parts" value={p.key} /> {p.label}</label>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>Work notes</label>
                <textarea name="notes" placeholder="What was done during the rebuild across the batch…" />
              </div>
            </div>

            {/* STEP 3 — Pressure test */}
            <div style={show(3)}>
              <div className="section-label">Pressure test (combined)</div>
              <p className="hint" style={{ marginTop: -8, marginBottom: 14 }}>One combined test result for the batch. Run the live test — pressure, hold time, and result fill in automatically.</p>
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
                <label>Batch outcome</label>
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
                  <input type="text" name="opName" placeholder="Field / QA representative" defaultValue={contactName} />
                </div>
                <div className="field">
                  <label>Operator signer email</label>
                  <input type="email" name="opEmail" placeholder="Optional" />
                </div>
              </div>
              <div className="callout blue">
                <span>PSI signs first, then the operator accepts. When both have signed, one certificate covering all {units.length} units is issued, and a single combined invoice is available.</span>
              </div>
            </div>

            {err && <div className="callout amber" style={{ marginTop: 16 }}><span>{err}</span></div>}

            <div className="wrap-actions mt" style={{ justifyContent: "space-between" }}>
              <div>{step > 0 && <button type="button" className="btn secondary" onClick={back}>← Back</button>}</div>
              <div className="wrap-actions">
                {step < last && <button type="button" className="btn" onClick={next}>Next →</button>}
                {step === last && <button type="submit" className="btn">Create combined work order</button>}
              </div>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
