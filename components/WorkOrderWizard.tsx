"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveWorkOrderDraft } from "@/app/actions";
import { WEAR_PARTS, CUSTOMERS, DELIVERY_METHOD, OUTCOME } from "@/lib/constants";
import NameplateCapture from "@/components/NameplateCapture";

type Extra = { serialNumber: string; manufacturer: string; model: string };

type Prefill = {
  draftId?: string;
  serial?: string; manufacturer?: string; customer?: string; model?: string;
  technician?: string; inspectionNotes?: string; notes?: string; outcome?: string;
  parts?: string[];
  deliveryMethod?: string; receivedByPsi?: string; releasedByClient?: string;
  psiName?: string; psiEmail?: string; opName?: string; opEmail?: string;
  requestId?: string;
  extras?: Extra[];
};

// Pressure test is hidden for now (not ready) — re-add "Pressure test" here to restore it.
const STEPS = ["Units & receiving", "Inspection", "Work performed", "Sign-off & outcome"];

export default function WorkOrderWizard({ prefill }: { prefill?: Prefill }) {
  const sp = prefill || {};
  const fromRequest = !!sp.requestId;
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [err, setErr] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const last = STEPS.length - 1;

  const [extras, setExtras] = useState<Extra[]>(sp.extras || []);
  const unitCount = 1 + extras.length;

  // Auto-save state.
  const [draftId, setDraftId] = useState(sp.draftId || "");
  const draftIdRef = useRef(sp.draftId || "");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(sp.draftId ? "saved" : "idle");
  const chainRef = useRef<Promise<unknown>>(Promise.resolve());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const val = (name: string) => {
    const el = formRef.current?.elements.namedItem(name) as HTMLInputElement | null;
    return (el?.value || "").trim();
  };

  /** Persist the current form (optionally with the nameplate file). Returns the job id, or null if nothing to save yet. */
  async function doSave(includeFile: boolean): Promise<string | null> {
    const form = formRef.current;
    if (!form) return null;
    if (!val("serialNumber") || !val("manufacturer")) return null; // not enough to persist
    const fd = new FormData(form);
    if (!includeFile) fd.delete("nameplatePhoto");
    fd.set("draftId", draftIdRef.current || "");
    setSaveState("saving");
    try {
      const res = await saveWorkOrderDraft(fd);
      draftIdRef.current = res.id;
      setDraftId(res.id);
      setSaveState("saved");
      return res.id;
    } catch {
      setSaveState("error");
      return null;
    }
  }

  /** Serialize saves so they never overlap; returns the save's result. */
  function enqueue(includeFile: boolean): Promise<string | null> {
    const run = chainRef.current.then(() => doSave(includeFile), () => doSave(includeFile)) as Promise<string | null>;
    chainRef.current = run.then(() => {}, () => {});
    return run;
  }

  function scheduleSave() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { enqueue(false); }, 1200);
  }
  function flushSave() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    enqueue(false);
  }
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const setExtra = (i: number, patch: Partial<Extra>) => { setExtras((p) => p.map((u, idx) => (idx === i ? { ...u, ...patch } : u))); scheduleSave(); };
  const addExtra = () => setExtras((p) => [...p, { serialNumber: "", manufacturer: "", model: "" }]);
  const removeExtra = (i: number) => { setExtras((p) => p.filter((_, idx) => idx !== i)); scheduleSave(); };

  function goStep(n: number) { flushSave(); setErr(""); setStep(Math.max(0, Math.min(n, last))); }
  function next() {
    if (step === 0 && (!val("serialNumber") || !val("manufacturer"))) { setErr("Enter at least the serial number and manufacturer."); return; }
    if (step === 2 && !val("technician")) { setErr("Enter the PSI technician who performed the work."); return; }
    goStep(step + 1);
  }
  const back = () => goStep(step - 1);
  const show = (n: number) => ({ display: step === n ? "block" : "none" });

  /** Explicit save / finalize — persists with the nameplate file, then opens the work order. */
  async function saveAndOpen() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const id = await enqueue(true);
    if (!id) { setErr("Enter at least a serial number and manufacturer to save."); return; }
    router.push(`/jobs/${id}`);
  }

  const savedLabel =
    saveState === "saving" ? "Saving…" : saveState === "saved" ? "Draft saved ✓" : saveState === "error" ? "Save failed — keep going, we’ll retry" : "";

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{sp.draftId ? "Edit work order" : "New work order"}</h1>
          <p>
            Step {step + 1} of {STEPS.length} — {STEPS[step]}{unitCount > 1 ? ` · ${unitCount} units` : ""}
            {savedLabel && <span className="small muted" style={{ marginLeft: 10, color: saveState === "error" ? "var(--red)" : "var(--muted)" }}>· {savedLabel}</span>}
          </p>
        </div>
        <Link href="/" className="btn secondary">Done</Link>
      </div>

      {/* Stepper */}
      <div style={{ display: "flex", gap: 8, marginBottom: 22, flexWrap: "wrap" }}>
        {STEPS.map((s, i) => {
          const state = i === step ? "active" : i < step ? "done" : "todo";
          return (
            <div key={s} onClick={() => i < step && goStep(i)}
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

      <form ref={formRef} className="stack" onSubmit={(e) => { e.preventDefault(); saveAndOpen(); }} onInput={scheduleSave}>
        {fromRequest && <input type="hidden" name="requestId" defaultValue={sp.requestId} />}

        <div className="card">
          <div className="card-body">
            {/* STEP 0 — Units & receiving */}
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

              <div className="section-label" style={{ marginTop: 10 }}>
                Additional fluid ends
                {extras.length > 0 && <span className="badge awaiting" style={{ marginLeft: 6 }}>{unitCount} units total</span>}
              </div>
              <p className="hint" style={{ marginTop: -6, marginBottom: 12 }}>
                Add more units to handle them on one combined work order — a single sign-off, one certificate, and one combined invoice covering all of them.
              </p>
              {extras.map((u, i) => (
                <div key={i} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 14, marginBottom: 12, background: "#fbfaf7" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span className="small" style={{ fontWeight: 700, color: "var(--ink-2)" }}>Unit {i + 2}</span>
                    <button type="button" className="linkbtn" onClick={() => removeExtra(i)}>✕ Remove</button>
                  </div>
                  <div className="grid-2">
                    <div className="field">
                      <label>Serial number <span className="req">*</span></label>
                      <input type="text" name="extraSerial" value={u.serialNumber} onChange={(e) => setExtra(i, { serialNumber: e.target.value })} placeholder="e.g. FE-2200-00842" />
                    </div>
                    <div className="field">
                      <label>Manufacturer <span className="req">*</span></label>
                      <input type="text" name="extraManufacturer" value={u.manufacturer} onChange={(e) => setExtra(i, { manufacturer: e.target.value })} placeholder="e.g. SPM" />
                    </div>
                  </div>
                  <div className="field">
                    <label>Model / spec</label>
                    <input type="text" name="extraModel" value={u.model} onChange={(e) => setExtra(i, { model: e.target.value })} placeholder="Optional" />
                  </div>
                </div>
              ))}
              <div><button type="button" className="btn secondary small" onClick={addExtra}>+ Add another fluid end</button></div>

              <div className="section-label" style={{ marginTop: 14 }}>Receiving — chain of custody</div>
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
                  <input type="text" name="releasedByClient" className="sig-input" autoComplete="off" placeholder="Client representative" defaultValue={sp.releasedByClient || sp.opName || ""} />
                </div>
                <div className="field">
                  <label>Received by (PSI) — sign</label>
                  <input type="text" name="receivedByPsi" className="sig-input" autoComplete="off" placeholder="PSI technician taking possession" defaultValue={sp.receivedByPsi || ""} />
                </div>
              </div>
            </div>

            {/* STEP 1 — Inspection */}
            <div style={show(1)}>
              <div className="section-label">Inspection</div>
              <div className="field">
                <label>Incoming inspection findings</label>
                <textarea name="inspectionNotes" placeholder="Condition on arrival — bore wear, washout, cracks, seat/valve condition, anything noteworthy…" defaultValue={sp.inspectionNotes || ""} />
                <div className="hint">Recorded on the work order as the inspection stage.</div>
              </div>
            </div>

            {/* STEP 2 — Work performed */}
            <div style={show(2)}>
              <div className="section-label">Work performed</div>
              <div className="field">
                <label>PSI technician <span className="req">*</span></label>
                <input type="text" name="technician" placeholder="Name of the tech who performed the work" defaultValue={sp.technician || ""} />
              </div>
              <div className="field">
                <label>Replaced wear parts</label>
                <div className="checks">
                  {WEAR_PARTS.map((p) => (
                    <label className="check" key={p.key}>
                      <input type="checkbox" name="parts" value={p.key} defaultChecked={sp.parts?.includes(p.key)} /> {p.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>Work notes</label>
                <textarea name="notes" placeholder="What was done during the rebuild…" defaultValue={sp.notes || ""} />
              </div>
            </div>

            {/* STEP 3 — Sign-off & outcome (pressure test hidden for now) */}
            <div style={show(3)}>
              <div className="section-label">Outcome</div>
              <div className="field">
                <label>Work order outcome</label>
                <select name="outcome" defaultValue={sp.outcome || OUTCOME.READY_DELIVERY}>
                  <option value={OUTCOME.READY_DELIVERY}>Ready for delivery</option>
                  <option value={OUTCOME.READY_PICKUP}>Ready for pickup</option>
                  <option value={OUTCOME.SCRAP}>Scrap — cannot repair</option>
                </select>
              </div>

              <div className="section-label" style={{ marginTop: 10 }}>Signers (dual sign-off)</div>
              <div className="grid-2">
                <div className="field">
                  <label>PSI signer name</label>
                  <input type="text" name="psiName" placeholder="Defaults to the technician" defaultValue={sp.psiName || ""} />
                </div>
                <div className="field">
                  <label>PSI signer email</label>
                  <input type="email" name="psiEmail" placeholder="Optional" defaultValue={sp.psiEmail || ""} />
                </div>
              </div>
              <div className="grid-2">
                <div className="field">
                  <label>Operator (Pro Petro) signer name</label>
                  <input type="text" name="opName" placeholder="Field / QA representative" defaultValue={sp.opName || ""} />
                </div>
                <div className="field">
                  <label>Operator signer email</label>
                  <input type="email" name="opEmail" placeholder="Optional" defaultValue={sp.opEmail || ""} />
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
                <button type="button" className="btn secondary" onClick={saveAndOpen}>Save draft</button>
                {step < last && <button type="button" className="btn" onClick={next}>Next →</button>}
                {step === last && <button type="submit" className="btn">{sp.draftId ? "Save work order" : "Create work order"}</button>}
              </div>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
