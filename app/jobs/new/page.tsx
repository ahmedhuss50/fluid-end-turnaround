import Link from "next/link";
import { createTurnaround } from "@/app/actions";
import { WEAR_PARTS } from "@/lib/constants";
import PressureTestField from "@/components/PressureTestField";

export default function NewTurnaround() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>New work order</h1>
          <p>Capture the unit, work performed, and pressure test. You&apos;ll route it for signatures next.</p>
        </div>
        <Link href="/" className="btn secondary">Cancel</Link>
      </div>

      <form action={createTurnaround} className="stack">
        <div className="card">
          <div className="card-body">
            <div className="section-label">Unit identity</div>
            <div className="grid-2">
              <div className="field">
                <label>Serial number <span className="req">*</span></label>
                <input type="text" name="serialNumber" required placeholder="e.g. FE-2200-00841" />
                <div className="hint">Existing units are matched by serial number; new ones are created automatically.</div>
              </div>
              <div className="field">
                <label>Manufacturer <span className="req">*</span></label>
                <input type="text" name="manufacturer" required placeholder="e.g. SPM / Gardner Denver" />
              </div>
            </div>
            <div className="grid-2">
              <div className="field">
                <label>Customer / operator <span className="req">*</span></label>
                <input type="text" name="customer" required placeholder="e.g. Pro Petro" defaultValue="Pro Petro" />
              </div>
              <div className="field">
                <label>Model / spec</label>
                <input type="text" name="model" placeholder="Optional configuration details" />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="section-label">Work performed</div>
            <div className="field">
              <label>PSI technician <span className="req">*</span></label>
              <input type="text" name="technician" required placeholder="Name of the tech who performed the turnaround" />
            </div>
            <div className="field">
              <label>Replaced wear parts</label>
              <div className="checks">
                {WEAR_PARTS.map((p) => (
                  <label className="check" key={p.key}>
                    <input type="checkbox" name="parts" value={p.key} />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Notes</label>
              <textarea name="notes" placeholder="Condition on intake, anything noteworthy about the rebuild…" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="section-label">Pressure test</div>
            <p className="hint" style={{ marginTop: -8, marginBottom: 14 }}>
              Run the live test below — the achieved pressure, hold time, and result fill in automatically (and stay editable).
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
        </div>

        <div className="card">
          <div className="card-body">
            <div className="section-label">Signers (dual sign-off)</div>
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
                <input type="text" name="opName" placeholder="Field / QA representative" />
              </div>
              <div className="field">
                <label>Operator signer email</label>
                <input type="email" name="opEmail" placeholder="Optional" />
              </div>
            </div>
            <div className="callout blue">
              PSI signs first, then the operator accepts. When both have signed, a tamper-evident PDF certificate is issued automatically.
            </div>
          </div>
        </div>

        <div className="wrap-actions mt">
          <button type="submit" className="btn">Create turnaround record</button>
          <Link href="/" className="btn secondary">Cancel</Link>
        </div>
      </form>
    </>
  );
}
