import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { PART_LABEL, PARTY_LABEL } from "./constants";
import { getStorage } from "./storage";

interface CertData {
  jobNumber: string;
  serialNumber: string;
  manufacturer: string;
  customer: string;
  model?: string | null;
  units?: { serialNumber: string; manufacturer: string; model?: string | null }[]; // all units on a batch
  technician: string;
  intakeDate: Date;
  completedDate: Date;
  replacedParts: string[];
  notes?: string | null;
  test: {
    testPressurePsi: number;
    holdTimeMinutes: number;
    result: string;
    gauge?: string | null;
    testedBy: string;
    testedAt: Date;
  } | null;
  signatures: {
    party: string;
    signerName: string;
    signerRole?: string | null;
    signedAt: Date | null;
    auditMeta?: string | null;
  }[];
}

const INK = rgb(0.12, 0.16, 0.2);
const BLUE = rgb(0.184, 0.435, 0.698);
const GREEN = rgb(0.18, 0.49, 0.355);
const GREY = rgb(0.42, 0.46, 0.5);
const LINE = rgb(0.78, 0.8, 0.83);

function fmt(d: Date) {
  return d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

/**
 * Generates a signed work order certificate PDF and writes it to
 * public/certificates/<jobNumber>.pdf. Returns the public path.
 */
export async function generateCertificate(data: CertData): Promise<string> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]); // US Letter
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const { width } = page.getSize();
  const M = 54;
  let y = 748;

  const text = (
    s: string,
    x: number,
    yy: number,
    size = 10,
    f = font,
    color = INK
  ) => page.drawText(s, { x, y: yy, size, font: f, color });

  const hr = (yy: number) =>
    page.drawLine({
      start: { x: M, y: yy },
      end: { x: width - M, y: yy },
      thickness: 1,
      color: LINE,
    });

  // Header
  page.drawRectangle({ x: 0, y: 762, width, height: 30, color: BLUE });
  text("FLUID END WORK ORDER CERTIFICATE", M, 771, 13, bold, rgb(1, 1, 1));

  y = 726;
  text("Work order record & dual acceptance", M, y, 10, font, GREY);
  text(`Certificate No.  ${data.jobNumber}`, width - M - 190, y, 10, bold, INK);
  y -= 14;
  hr(y);
  y -= 24;

  // Unit identity block
  const label = (s: string, x: number, yy: number) => text(s, x, yy, 8.5, bold, GREY);
  const value = (s: string, x: number, yy: number) => text(s, x, yy, 11, font, INK);

  const col1 = M;
  const col2 = M + 285;

  label("SERIAL NUMBER", col1, y);
  label("MANUFACTURER", col2, y);
  y -= 15;
  value(data.serialNumber, col1, y);
  value(data.manufacturer, col2, y);
  y -= 26;

  label("CUSTOMER / OPERATOR", col1, y);
  label("MODEL / SPEC", col2, y);
  y -= 15;
  value(data.customer, col1, y);
  value(data.model || "—", col2, y);
  y -= 26;

  label("PSI TECHNICIAN", col1, y);
  label("DATES", col2, y);
  y -= 15;
  value(data.technician, col1, y);
  value(
    `Intake ${data.intakeDate.toISOString().slice(0, 10)}  ·  Completed ${data.completedDate
      .toISOString()
      .slice(0, 10)}`,
    col2,
    y
  );
  y -= 28;
  hr(y);
  y -= 22;

  // Units covered (batch / combined work order)
  if (data.units && data.units.length > 1) {
    text(`UNITS COVERED (${data.units.length})`, M, y, 8.5, bold, GREY);
    y -= 16;
    data.units.forEach((u, i) => {
      const line = `${i + 1}.  ${u.serialNumber}    ·    ${u.manufacturer}${u.model ? `    ·    ${u.model}` : ""}`;
      text(line, M, y, 10, font, INK);
      y -= 14;
    });
    y -= 8;
    hr(y);
    y -= 22;
  }

  // Replaced parts
  text("REPLACED PARTS", M, y, 8.5, bold, GREY);
  y -= 16;
  const partsStr =
    data.replacedParts.length > 0
      ? data.replacedParts.map((p) => PART_LABEL[p] || p).join(",  ")
      : "None recorded";
  text(partsStr, M, y, 11, font, INK);
  y -= 26;

  if (data.notes) {
    text("NOTES", M, y, 8.5, bold, GREY);
    y -= 16;
    // simple wrap
    const words = data.notes.split(/\s+/);
    let line = "";
    const maxWidth = width - 2 * M;
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (font.widthOfTextAtSize(test, 10) > maxWidth) {
        text(line, M, y, 10, font, INK);
        y -= 14;
        line = w;
      } else line = test;
    }
    if (line) {
      text(line, M, y, 10, font, INK);
      y -= 14;
    }
    y -= 10;
  }

  hr(y);
  y -= 22;

  // Pressure test
  text("PRESSURE TEST", M, y, 8.5, bold, GREY);
  y -= 18;
  if (data.test) {
    const passed = data.test.result === "PASS";
    // result badge
    const badge = passed ? "PASS" : "FAIL";
    const badgeColor = passed ? GREEN : rgb(0.7, 0.16, 0.16);
    page.drawRectangle({
      x: M,
      y: y - 4,
      width: 52,
      height: 18,
      color: passed ? rgb(0.89, 0.95, 0.92) : rgb(0.98, 0.9, 0.9),
      borderColor: badgeColor,
      borderWidth: 1,
    });
    text(badge, M + 12, y, 10, bold, badgeColor);

    text(
      `Test pressure: ${data.test.testPressurePsi.toLocaleString()} psi     Hold time: ${data.test.holdTimeMinutes} min     Instrument: ${data.test.gauge || "—"}`,
      M + 66,
      y,
      10,
      font,
      INK
    );
    y -= 16;
    text(
      `Tested by ${data.test.testedBy} on ${fmt(data.test.testedAt)}`,
      M + 66,
      y,
      9,
      font,
      GREY
    );
    y -= 24;
  } else {
    text("No pressure test on record.", M, y, 10, font, GREY);
    y -= 24;
  }

  hr(y);
  y -= 24;

  // Signatures
  text("ACCEPTANCE SIGNATURES", M, y, 8.5, bold, GREY);
  y -= 22;

  const boxW = (width - 2 * M - 20) / 2;
  const ordered = [...data.signatures].sort((a, b) =>
    a.party === "PSI" ? -1 : b.party === "PSI" ? 1 : 0
  );
  ordered.slice(0, 2).forEach((sig, i) => {
    const bx = M + i * (boxW + 20);
    page.drawRectangle({
      x: bx,
      y: y - 70,
      width: boxW,
      height: 78,
      borderColor: LINE,
      borderWidth: 1,
      color: rgb(0.98, 0.99, 1),
    });
    text(PARTY_LABEL[sig.party] || sig.party, bx + 12, y - 12, 9, bold, BLUE);
    // signature script-style name
    text(sig.signerName, bx + 12, y - 34, 15, bold, INK);
    text(sig.signerRole || "", bx + 12, y - 48, 8.5, font, GREY);
    text(
      sig.signedAt ? `Signed ${fmt(sig.signedAt)}` : "Not signed",
      bx + 12,
      y - 62,
      8,
      font,
      GREY
    );
  });
  y -= 92;

  // Footer / audit
  hr(y);
  y -= 16;
  text(
    "This certificate was generated electronically by the Fluid End Work Order System.",
    M,
    y,
    8,
    font,
    GREY
  );
  y -= 11;
  const auditRefs = data.signatures
    .map((s) => {
      try {
        const m = s.auditMeta ? JSON.parse(s.auditMeta) : {};
        return `${s.party}:${m.providerRef || "n/a"}`;
      } catch {
        return `${s.party}:n/a`;
      }
    })
    .join("   ");
  text(`Audit references — ${auditRefs}`, M, y, 8, font, GREY);
  y -= 11;
  text(`Generated ${fmt(new Date())}`, M, y, 8, font, GREY);

  const bytes = await pdf.save();
  // Stored via the configured driver (local disk in dev, Supabase Storage in prod)
  // and served by the /certificate/[jobNumber] route handler.
  await getStorage().put(data.jobNumber, bytes);
  return `/certificate/${encodeURIComponent(data.jobNumber)}`;
}
