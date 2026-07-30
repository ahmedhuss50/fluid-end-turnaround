import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getStorage } from "./storage";
import { fmtMoney, computeTotals, type InvoiceLine } from "./money";

export interface InvoiceData {
  invoiceNumber: string;
  issuedAt: Date;
  currency: string;
  terms?: string | null;
  poNumber?: string | null;
  notes?: string | null;
  taxRatePct: number;
  billToCompany: string;
  billToContact?: string | null;
  jobNumber: string;
  serialNumber: string;
  manufacturer: string;
  completedDate?: Date | null;
  items: InvoiceLine[];
}

const INK = rgb(0.12, 0.16, 0.2);
const RED = rgb(0.784, 0.063, 0.18); // #c8102e
const GREY = rgb(0.42, 0.46, 0.5);
const LINE = rgb(0.78, 0.8, 0.83);
const SOFT = rgb(0.97, 0.96, 0.93);

function d(date?: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "—";
}

/**
 * Renders an invoice PDF and stores it via the configured driver.
 * Returns the app path (/invoice/<number>) that serves it.
 */
export async function generateInvoicePdf(data: InvoiceData): Promise<string> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]); // US Letter
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const { width } = page.getSize();
  const M = 54;
  const right = width - M;

  const text = (s: string, x: number, y: number, size = 10, f = font, color = INK) =>
    page.drawText(s, { x, y, size, font: f, color });
  const rtext = (s: string, x: number, y: number, size = 10, f = font, color = INK) =>
    page.drawText(s, { x: x - f.widthOfTextAtSize(s, size), y, size, font: f, color });
  const hr = (y: number, color = LINE) =>
    page.drawLine({ start: { x: M, y }, end: { x: right, y }, thickness: 1, color });

  // Header band
  page.drawRectangle({ x: 0, y: 742, width, height: 50, color: RED });
  text("PSI Portal", M, 763, 18, bold, rgb(1, 1, 1));
  text("Fluid End Work Orders", M, 750, 9, font, rgb(1, 0.85, 0.87));
  rtext("INVOICE", right, 760, 20, bold, rgb(1, 1, 1));

  let y = 712;
  // Meta (right) + Bill-to (left)
  text("BILL TO", M, y, 8.5, bold, GREY);
  rtext(`Invoice  ${data.invoiceNumber}`, right, y, 10, bold, INK);
  y -= 15;
  text(data.billToCompany, M, y, 12, bold, INK);
  rtext(`Date issued   ${d(data.issuedAt)}`, right, y, 9.5, font, INK);
  y -= 14;
  if (data.billToContact) text(data.billToContact, M, y, 10, font, INK);
  rtext(`Terms   ${data.terms || "Net 30"}`, right, y, 9.5, font, INK);
  y -= 14;
  if (data.poNumber) rtext(`PO #   ${data.poNumber}`, right, y, 9.5, font, INK);

  y -= 22;
  hr(y);
  y -= 16;

  // Work-order reference strip
  text("WORK ORDER", M, y, 8.5, bold, GREY);
  text("SERIAL #", M + 150, y, 8.5, bold, GREY);
  text("MANUFACTURER", M + 300, y, 8.5, bold, GREY);
  text("COMPLETED", M + 430, y, 8.5, bold, GREY);
  y -= 14;
  text(data.jobNumber, M, y, 10, font, INK);
  text(data.serialNumber, M + 150, y, 10, font, INK);
  text(data.manufacturer, M + 300, y, 10, font, INK);
  text(d(data.completedDate), M + 430, y, 10, font, INK);

  y -= 24;

  // Line-item table header
  const cQty = right - 210;
  const cUnit = right - 120;
  page.drawRectangle({ x: M, y: y - 6, width: right - M, height: 22, color: SOFT });
  text("DESCRIPTION", M + 8, y, 8.5, bold, GREY);
  rtext("QTY", cQty, y, 8.5, bold, GREY);
  rtext("UNIT", cUnit, y, 8.5, bold, GREY);
  rtext("AMOUNT", right - 8, y, 8.5, bold, GREY);
  y -= 24;

  const cur = data.currency || "USD";
  for (const it of data.items) {
    const amount = Math.round((it.quantity || 0) * (it.unitPriceCents || 0));
    const qtyStr = Number.isInteger(it.quantity) ? String(it.quantity) : it.quantity.toFixed(2);
    // wrap description if long
    const desc = it.description || "—";
    const maxDescW = cQty - (M + 8) - 12;
    let line = desc;
    if (font.widthOfTextAtSize(desc, 10) > maxDescW) {
      while (line.length > 3 && font.widthOfTextAtSize(line + "…", 10) > maxDescW) line = line.slice(0, -1);
      line = line + "…";
    }
    text(line, M + 8, y, 10, font, INK);
    rtext(qtyStr, cQty, y, 10, font, INK);
    rtext(fmtMoney(it.unitPriceCents, cur), cUnit, y, 10, font, INK);
    rtext(fmtMoney(amount, cur), right - 8, y, 10, font, INK);
    y -= 8;
    hr(y, rgb(0.93, 0.92, 0.89));
    y -= 14;
  }

  // Totals
  const { subtotalCents, taxCents, totalCents } = computeTotals(data.items, data.taxRatePct);
  y -= 6;
  const labelX = cUnit;
  rtext("Subtotal", labelX, y, 10, font, GREY);
  rtext(fmtMoney(subtotalCents, cur), right - 8, y, 10, font, INK);
  y -= 16;
  rtext(`Tax (${(data.taxRatePct || 0).toFixed(2)}%)`, labelX, y, 10, font, GREY);
  rtext(fmtMoney(taxCents, cur), right - 8, y, 10, font, INK);
  y -= 10;
  page.drawLine({ start: { x: labelX - 120, y }, end: { x: right, y }, thickness: 1, color: LINE });
  y -= 18;
  rtext("TOTAL DUE", labelX, y, 12, bold, INK);
  rtext(fmtMoney(totalCents, cur), right - 8, y, 13, bold, RED);

  y -= 40;
  if (data.notes) {
    text("NOTES", M, y, 8.5, bold, GREY);
    y -= 14;
    const words = data.notes.split(/\s+/);
    let ln = "";
    const maxW = right - M;
    for (const w of words) {
      const t = ln ? ln + " " + w : w;
      if (font.widthOfTextAtSize(t, 9.5) > maxW) {
        text(ln, M, y, 9.5, font, INK);
        y -= 13;
        ln = w;
      } else ln = t;
    }
    if (ln) {
      text(ln, M, y, 9.5, font, INK);
      y -= 13;
    }
  }

  // Footer
  text("Thank you for your business.", M, 70, 9.5, bold, INK);
  text(
    `Remit per terms: ${data.terms || "Net 30"}. Questions? Reference ${data.invoiceNumber}.`,
    M,
    56,
    8.5,
    font,
    GREY
  );
  text("Generated by the PSI Fluid End Work Order System.", M, 44, 8, font, GREY);

  const bytes = await pdf.save();
  await getStorage().putObject(`invoices/${data.invoiceNumber}.pdf`, bytes, "application/pdf");
  return `/invoice/${encodeURIComponent(data.invoiceNumber)}`;
}
