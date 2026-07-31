"use client";

import { useState } from "react";
import { submitBatchRequest } from "@/app/actions";
import { CUSTOMERS, DELIVERY_METHOD } from "@/lib/constants";

type Unit = { serialNumber: string; manufacturer: string; model: string; problem: string };

const blank = (): Unit => ({ serialNumber: "", manufacturer: "", model: "", problem: "" });

export default function BatchRequestForm() {
  const [units, setUnits] = useState<Unit[]>([blank(), blank()]);

  const setU = (i: number, patch: Partial<Unit>) =>
    setUnits((prev) => prev.map((u, idx) => (idx === i ? { ...u, ...patch } : u)));
  const add = () => setUnits((prev) => [...prev, blank()]);
  const remove = (i: number) => setUnits((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <form action={submitBatchRequest} className="stack">
      <div className="card">
        <div className="card-head"><h2>Submit a batch of fluid ends</h2></div>
        <div className="card-body">
          <div className="section-label">Client &amp; contact</div>
          <div className="grid-2">
            <div className="field">
              <label>Company (fluid-end owner) <span className="req">*</span></label>
              <select name="company" required defaultValue={CUSTOMERS[0]}>
                {CUSTOMERS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Contact name <span className="req">*</span></label>
              <input type="text" name="contactName" required placeholder="Who to reach about this batch" />
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Contact email</label>
              <input type="email" name="contactEmail" placeholder="Optional" />
            </div>
            <div className="field">
              <label>How will PSI receive them?</label>
              <select name="deliveryMethod" defaultValue={DELIVERY_METHOD.DELIVERY}>
                <option value={DELIVERY_METHOD.DELIVERY}>We&apos;ll deliver them to PSI</option>
                <option value={DELIVERY_METHOD.PICKUP}>PSI picks them up from us</option>
              </select>
            </div>
          </div>

          <div className="section-label" style={{ marginTop: 8 }}>
            Fluid ends in this batch <span className="badge awaiting" style={{ marginLeft: 6 }}>{units.length}</span>
          </div>

          {units.map((u, i) => (
            <div key={i} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 14, marginBottom: 12, background: "#fbfaf7" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span className="small" style={{ fontWeight: 700, color: "var(--ink-2)" }}>Unit {i + 1}</span>
                {units.length > 1 && (
                  <button type="button" className="linkbtn" onClick={() => remove(i)} aria-label="Remove unit">✕ Remove</button>
                )}
              </div>
              <div className="grid-2">
                <div className="field">
                  <label>Serial number <span className="req">*</span></label>
                  <input type="text" name="unitSerial" value={u.serialNumber} onChange={(e) => setU(i, { serialNumber: e.target.value })} placeholder="e.g. FE-2200-00841" />
                </div>
                <div className="field">
                  <label>Manufacturer <span className="req">*</span></label>
                  <input type="text" name="unitManufacturer" value={u.manufacturer} onChange={(e) => setU(i, { manufacturer: e.target.value })} placeholder="e.g. SPM / Gardner Denver" />
                </div>
              </div>
              <div className="grid-2">
                <div className="field">
                  <label>Model / spec</label>
                  <input type="text" name="unitModel" value={u.model} onChange={(e) => setU(i, { model: e.target.value })} placeholder="Optional" />
                </div>
                <div className="field">
                  <label>Problem / reason</label>
                  <input type="text" name="unitProblem" value={u.problem} onChange={(e) => setU(i, { problem: e.target.value })} placeholder="e.g. Washout, failed test" />
                </div>
              </div>
            </div>
          ))}

          <div><button type="button" className="btn secondary small" onClick={add}>+ Add another fluid end</button></div>

          <div className="section-label" style={{ marginTop: 14 }}>Client authorization</div>
          <div className="grid-2">
            <div className="field">
              <label>Authorizing signature — type full name <span className="req">*</span></label>
              <input type="text" name="clientSignerName" required className="sig-input" autoComplete="off" placeholder="Client representative" />
            </div>
            <div className="field">
              <label>Title</label>
              <input type="text" name="clientSignerTitle" placeholder="e.g. Field Superintendent" />
            </div>
          </div>
          <div className="field">
            <label>Batch notes</label>
            <textarea name="notes" placeholder="Anything PSI should know about this batch as a whole…" />
          </div>
          <div className="callout blue">
            <span>By typing your name you authorize PSI to inspect and repair all {units.length} fluid ends in this batch. One authorization covers the whole batch; PSI handles them as a single combined work order.</span>
          </div>

          <div className="wrap-actions mt">
            <button type="submit" className="btn">Submit batch request</button>
          </div>
        </div>
      </div>
    </form>
  );
}
