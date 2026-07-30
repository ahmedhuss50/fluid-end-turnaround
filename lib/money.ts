// Currency helpers. Amounts are integer cents everywhere to avoid float drift.

export function fmtMoney(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format((cents || 0) / 100);
}

/** Parse a user-typed dollar string (e.g. "1,250.50" or "$1250") to integer cents. */
export function dollarsToCents(input: string | number | null | undefined): number {
  if (input == null) return 0;
  const s = String(input).replace(/[^0-9.\-]/g, "");
  if (!s) return 0;
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.round(n * 100);
}

export type InvoiceLine = { description?: string; quantity: number; unitPriceCents: number };

export interface InvoiceTotals {
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
}

/** Compute subtotal/tax/total from line items and a percent tax rate. */
export function computeTotals(items: InvoiceLine[], taxRatePct = 0): InvoiceTotals {
  const subtotalCents = items.reduce(
    (sum, it) => sum + Math.round((it.quantity || 0) * (it.unitPriceCents || 0)),
    0
  );
  const taxCents = Math.round((subtotalCents * (taxRatePct || 0)) / 100);
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}
