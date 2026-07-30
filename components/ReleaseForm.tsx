"use client";

import { useState } from "react";
import { createRelease } from "@/app/actions";
import { CUSTOMERS, DELIVERY_METHOD } from "@/lib/constants";

export default function ReleaseForm({ customer }: { customer?: string }) {
  const [step, setStep] = useState(0);
  const [err, setErr] = useState("");

  return (
    <form action={createRelease} className="stack">
      {/* Step indicator */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {["Fluid end details", "Release signature"].map((s, i) => (
          <div key={s} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 999,
            border: "1px solid", fontSize: 13, fontWeight: 600,
            borderColor: i === step ? "var(--red)" : i < step ? "#c4e6d1" : "var(--line)",
            background: i === step ? "var(--red-bg)" : i < step ? "var(--green-bg)" : "#fff",
            color: i === step ? "var(--red-dark)" : i < step ? "var(--green)" : "var(--muted)",
          }}>
            <span style={{
              width: 20, height: 20, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, color: "#fff", background: i === step ? "var(--red)" : i < step ? "var(--green)" : "#c9c1b3",
            }}>{i < step ? "✓" : i + 1}</span>
            {s}
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-body">
          {/* Step 1 — details */}
          <div style={{ display: step === 0 ? "block" : "none" }}>
            <div className="section-label">Fluid end being released</div>
            <div className="grid-2">
              <div className="field">
                <label>Serial number <span className="req">*</span></label>
                <input type="text" name="serialNumber" placeholder="e.g. FE-2200-00841" />
              </div>
              <div className="field">
                <label>Manufacturer</label>
                <input type="text" name="manufacturer" placeholder="e.g. SPM / Gardner Denver" />
              </div>
            </div>
            <div className="grid-2">
              <div className="field">
                <label>Customer / operator <span className="req">*</span></label>
                <select name="customer" defaultValue={customer || CUSTOMERS[0]}>
                  {CUSTOMERS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Delivery method</label>
                <select name="deliveryMethod" defaultValue={DELIVERY_METHOD.DELIVERY}>
                  <option value={DELIVERY_METHOD.DELIVERY}>We&apos;ll deliver it to PSI</option>
                  <option value={DELIVERY_METHOD.PICKUP}>PSI picks it up from us</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>Condition at release</label>
              <textarea name="conditionNotes" placeholder="Any visible damage, missing parts, or notes about the unit at handoff…" />
            </div>
          </div>

          {/* Step 2 — release signature */}
          <div style={{ display: step === 1 ? "block" : "none" }}>
            <div className="section-label">Release signature (client)</div>
            <div className="grid-2">
              <div className="field">
                <label>Released by — type full name <span className="req">*</span></label>
                <input type="text" name="releasedByName" className="sig-input" autoComplete="off" placeholder="Client representative" />
              </div>
              <div className="field">
                <label>Title</label>
                <input type="text" name="releasedByTitle" placeholder="e.g. Field Superintendent" />
              </div>
            </div>
            <div className="callout blue">
              <span>By signing, you confirm you are releasing this fluid end to PSI. PSI will countersign to acknowledge receipt, creating a full chain-of-custody record.</span>
            </div>
          </div>

          {err && <div className="callout amber" style={{ marginTop: 16 }}><span>{err}</span></div>}

          <div className="wrap-actions mt" style={{ justifyContent: "space-between" }}>
            <div>{step > 0 && <button type="button" className="btn secondary" onClick={() => { setErr(""); setStep(0); }}>← Back</button>}</div>
            <div>
              {step === 0 && <button type="button" className="btn" onClick={() => setStep(1)}>Next → signature</button>}
              {step === 1 && <button type="submit" className="btn">Sign &amp; release</button>}
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
