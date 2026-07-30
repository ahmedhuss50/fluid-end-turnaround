"use client";

import { useState } from "react";
import { createRelease } from "@/app/actions";
import { CUSTOMERS, DELIVERY_METHOD } from "@/lib/constants";

type ReqOption = {
  id: string;
  requestNumber: string;
  serialNumber: string;
  manufacturer: string;
  customer: string;
  deliveryMethod: string | null;
  problem: string;
};

export default function ReleaseForm({ customer, requests = [] }: { customer?: string; requests?: ReqOption[] }) {
  const [step, setStep] = useState(0);
  const [err, setErr] = useState("");

  // Controlled so choosing a request can pre-fill them.
  const [requestId, setRequestId] = useState("");
  const [serial, setSerial] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [cust, setCust] = useState<string>(customer || CUSTOMERS[0]);
  const [delivery, setDelivery] = useState<string>(DELIVERY_METHOD.DELIVERY);
  const [condition, setCondition] = useState("");

  function pickRequest(id: string) {
    setRequestId(id);
    const r = requests.find((x) => x.id === id);
    if (r) {
      setSerial(r.serialNumber);
      setManufacturer(r.manufacturer);
      setCust(r.customer);
      if (r.deliveryMethod) setDelivery(r.deliveryMethod);
      setCondition(r.problem ? `From request ${r.requestNumber}: ${r.problem}` : "");
    }
  }

  return (
    <form action={createRelease} className="stack">
      <input type="hidden" name="requestId" value={requestId} />

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
            {requests.length > 0 && (
              <div className="field">
                <label>Releasing a unit from a repair request?</label>
                <select value={requestId} onChange={(e) => pickRequest(e.target.value)}>
                  <option value="">— Not from a request / enter manually —</option>
                  {requests.map((r) => (
                    <option key={r.id} value={r.id}>{r.requestNumber} · {r.serialNumber} · {r.manufacturer}</option>
                  ))}
                </select>
                <div className="hint">Pick a request you submitted and its details fill in below.</div>
              </div>
            )}

            <div className="section-label">Fluid end being released</div>
            <div className="grid-2">
              <div className="field">
                <label>Serial number <span className="req">*</span></label>
                <input type="text" name="serialNumber" value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="e.g. FE-2200-00841" />
              </div>
              <div className="field">
                <label>Manufacturer</label>
                <input type="text" name="manufacturer" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} placeholder="e.g. SPM / Gardner Denver" />
              </div>
            </div>
            <div className="grid-2">
              <div className="field">
                <label>Customer / operator <span className="req">*</span></label>
                <select name="customer" value={cust} onChange={(e) => setCust(e.target.value)}>
                  {CUSTOMERS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Delivery method</label>
                <select name="deliveryMethod" value={delivery} onChange={(e) => setDelivery(e.target.value)}>
                  <option value={DELIVERY_METHOD.DELIVERY}>We&apos;ll deliver it to PSI</option>
                  <option value={DELIVERY_METHOD.PICKUP}>PSI picks it up from us</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>Condition at release</label>
              <textarea name="conditionNotes" value={condition} onChange={(e) => setCondition(e.target.value)} placeholder="Any visible damage, missing parts, or notes about the unit at handoff…" />
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
              {step === 0 && <button type="button" className="btn" onClick={() => {
                if (!serial.trim()) { setErr("Enter or pick a serial number first."); return; }
                setErr(""); setStep(1);
              }}>Next → signature</button>}
              {step === 1 && <button type="submit" className="btn">Sign &amp; release</button>}
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
