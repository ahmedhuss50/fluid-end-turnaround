"use client";

import { useMemo, useState } from "react";
import { saveInvoice } from "@/app/actions";
import { fmtMoney } from "@/lib/money";

export type EditorItem = { description: string; quantity: number; unitPrice: string };

type Props = {
  jobId: string;
  invoiceNumber: string | null;
  status: string;
  pdfUrl: string | null;
  currency: string;
  taxRatePct: number;
  terms: string;
  poNumber: string;
  notes: string;
  items: EditorItem[];
};

function centsOf(dollars: string): number {
  const n = parseFloat(String(dollars).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? 0 : Math.round(n * 100);
}

export default function InvoiceEditor(props: Props) {
  const [items, setItems] = useState<EditorItem[]>(
    props.items.length ? props.items : [{ description: "Labor — fluid-end service", quantity: 1, unitPrice: "" }]
  );
  const [taxRatePct, setTaxRatePct] = useState(String(props.taxRatePct || 0));
  const [terms, setTerms] = useState(props.terms || "Net 30");
  const [poNumber, setPoNumber] = useState(props.poNumber || "");
  const [notes, setNotes] = useState(props.notes || "");

  const totals = useMemo(() => {
    const subtotal = items.reduce((s, it) => s + Math.round((Number(it.quantity) || 0) * centsOf(it.unitPrice)), 0);
    const tax = Math.round((subtotal * (parseFloat(taxRatePct) || 0)) / 100);
    return { subtotal, tax, total: subtotal + tax };
  }, [items, taxRatePct]);

  const setItem = (i: number, patch: Partial<EditorItem>) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const addRow = () => setItems((prev) => [...prev, { description: "", quantity: 1, unitPrice: "" }]);
  const removeRow = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));

  const issued = props.status === "ISSUED";

  return (
    <form action={saveInvoice.bind(null, props.jobId)} className="stack">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 4 }}>
        <div className="small muted">
          {props.invoiceNumber ? <>Invoice <span className="mono">{props.invoiceNumber}</span></> : "No invoice yet — save to create one."}
          {" "}
          <span className={`badge ${issued ? "completed" : "draft"}`} style={{ marginLeft: 6 }}>{issued ? "Issued" : "Draft"}</span>
        </div>
        {props.pdfUrl && (
          <a href={props.pdfUrl} className="btn secondary small" target="_blank" rel="noopener">↓ Download invoice PDF</a>
        )}
      </div>

      <table className="grid">
        <thead>
          <tr>
            <th>Description</th>
            <th style={{ width: 70 }}>Qty</th>
            <th style={{ width: 130 }}>Unit price</th>
            <th style={{ width: 110 }} className="right">Amount</th>
            <th style={{ width: 34 }}></th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => {
            const amount = Math.round((Number(it.quantity) || 0) * centsOf(it.unitPrice));
            return (
              <tr key={i}>
                <td>
                  <input name="desc" value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} placeholder="e.g. Replace valves" style={{ width: "100%" }} />
                </td>
                <td>
                  <input name="qty" type="number" min="0" step="0.5" value={it.quantity} onChange={(e) => setItem(i, { quantity: parseFloat(e.target.value) || 0 })} style={{ width: "100%" }} />
                </td>
                <td>
                  <input name="price" inputMode="decimal" value={it.unitPrice} onChange={(e) => setItem(i, { unitPrice: e.target.value })} placeholder="0.00" style={{ width: "100%" }} />
                </td>
                <td className="right mono">{fmtMoney(amount, props.currency)}</td>
                <td className="right">
                  {items.length > 1 && (
                    <button type="button" className="linkbtn" onClick={() => removeRow(i)} title="Remove line" aria-label="Remove line">✕</button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div>
        <button type="button" className="btn secondary small" onClick={addRow}>+ Add line</button>
      </div>

      <div className="grid-2" style={{ marginTop: 6 }}>
        <div className="field">
          <label>Tax rate (%)</label>
          <input name="taxRatePct" inputMode="decimal" value={taxRatePct} onChange={(e) => setTaxRatePct(e.target.value)} placeholder="0" />
        </div>
        <div className="field">
          <label>Terms</label>
          <input name="terms" value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Net 30" />
        </div>
      </div>
      <div className="grid-2">
        <div className="field">
          <label>Client PO # (optional)</label>
          <input name="poNumber" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="Purchase-order reference" />
        </div>
        <div className="field">
          <label>Notes (optional)</label>
          <input name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Appears on the invoice" />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <table style={{ borderCollapse: "collapse", minWidth: 260 }}>
          <tbody>
            <tr><td className="small muted" style={{ padding: "3px 14px 3px 0" }}>Subtotal</td><td className="right mono">{fmtMoney(totals.subtotal, props.currency)}</td></tr>
            <tr><td className="small muted" style={{ padding: "3px 14px 3px 0" }}>Tax ({parseFloat(taxRatePct) || 0}%)</td><td className="right mono">{fmtMoney(totals.tax, props.currency)}</td></tr>
            <tr><td style={{ padding: "6px 14px 0 0", fontWeight: 700, borderTop: "1px solid var(--line)" }}>Total</td><td className="right mono" style={{ fontWeight: 800, fontSize: 16, color: "var(--red)", borderTop: "1px solid var(--line)", paddingTop: 6 }}>{fmtMoney(totals.total, props.currency)}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="wrap-actions mt" style={{ justifyContent: "flex-end" }}>
        <button type="submit" className="btn">{issued ? "Save & regenerate invoice" : "Save invoice"}</button>
      </div>
      {issued && <div className="hint" style={{ textAlign: "right" }}>Saving re-issues the PDF with your changes.</div>}
    </form>
  );
}
