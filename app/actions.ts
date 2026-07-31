"use server";

import { prisma } from "@/lib/db";
import { JOB_STATUS, PARTY, TEST_RESULT, REQUEST_STATUS, STAGE_ORDER, INVOICE_STATUS, PART_LABEL } from "@/lib/constants";
import { nextJobNumber, nextRequestNumber, nextHandoffNumber, nextInvoiceNumber, newToken, appBaseUrl, fullJobInclude } from "@/lib/jobs";
import { getEsignProvider } from "@/lib/esign";
import { getStorage } from "@/lib/storage";
import { generateCertificate } from "@/lib/certificate";
import { notifyOperatorSignRequest, notifyOperatorCompleted } from "@/lib/notify";
import { generateInvoicePdf } from "@/lib/invoice";
import { dollarsToCents } from "@/lib/money";

/** Upload a captured nameplate photo (if present) and return its storage key. */
async function saveNameplate(formData: FormData, scope: "job" | "req", id: string): Promise<string | null> {
  const photo = formData.get("nameplatePhoto");
  if (!photo || typeof photo === "string" || photo.size === 0) return null;
  const key = `nameplates/${scope}-${id}.jpg`;
  try {
    const buf = new Uint8Array(await photo.arrayBuffer());
    await getStorage().putObject(key, buf, photo.type || "image/jpeg");
    return key;
  } catch {
    return null;
  }
}
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

/** Advance a work order to the next pipeline stage (kanban Move). */
export async function advanceStage(jobId: string) {
  const job = await prisma.turnaroundJob.findUnique({ where: { id: jobId }, select: { stage: true } });
  if (!job) return;
  const i = STAGE_ORDER.indexOf(job.stage);
  const next = STAGE_ORDER[Math.min(i + 1, STAGE_ORDER.length - 1)];
  if (next !== job.stage) {
    await prisma.turnaroundJob.update({ where: { id: jobId }, data: { stage: next } });
    revalidatePath("/board");
  }
}

/** Mark all of a recipient's portal notifications as read (clears the bell count). */
export async function markNotificationsRead(recipient: string) {
  await prisma.notification.updateMany({
    where: { recipient, read: false },
    data: { read: true },
  });
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

/** Switch the current view between PSI and client (Pro Petro). Sets the cookie
 *  authoritatively; the client then does a full-document navigation to the
 *  role's landing page, which re-renders the layout/sidebar from the server and
 *  bypasses the client Router Cache (the source of the "sidebar didn't change"
 *  bug). */
export async function setRole(role: string) {
  const r = role === "client" ? "client" : "psi";
  cookies().set("role", r, { path: "/", maxAge: 60 * 60 * 24 * 30 });
}

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/** Create a new turnaround record (status DRAFT) from the intake form. */
export async function createTurnaround(formData: FormData) {
  const serialNumber = str(formData, "serialNumber");
  const manufacturer = str(formData, "manufacturer");
  const customer = str(formData, "customer");
  const technician = str(formData, "technician");

  if (!serialNumber || !manufacturer || !customer || !technician) {
    throw new Error("Serial number, manufacturer, customer, and technician are required.");
  }

  const parts = formData.getAll("parts").map(String).filter(Boolean);
  const model = str(formData, "model") || null;
  const notes = str(formData, "notes") || null;
  const inspectionNotes = str(formData, "inspectionNotes") || null;
  const outcome = str(formData, "outcome") || null;

  // Pressure test
  const testPressurePsi = parseInt(str(formData, "testPressurePsi") || "0", 10);
  const holdTimeMinutes = parseInt(str(formData, "holdTimeMinutes") || "0", 10);
  const result = str(formData, "result") === TEST_RESULT.FAIL ? TEST_RESULT.FAIL : TEST_RESULT.PASS;
  const gauge = str(formData, "gauge") || null;
  const testedBy = str(formData, "testedBy") || technician;

  // Signers
  const psiName = str(formData, "psiName") || technician;
  const psiEmail = str(formData, "psiEmail") || null;
  const opName = str(formData, "opName");
  const opEmail = str(formData, "opEmail") || null;

  // Receiving / chain of custody
  const deliveryMethod = str(formData, "deliveryMethod") || null;
  const receivedByPsi = str(formData, "receivedByPsi") || null;
  const releasedByClient = str(formData, "releasedByClient") || null;

  // Upsert the fluid end (permanent unit record keyed by serial number).
  const fluidEnd = await prisma.fluidEnd.upsert({
    where: { serialNumber },
    update: { manufacturer, customer, model: model ?? undefined },
    create: { serialNumber, manufacturer, customer, model },
  });

  const jobNumber = await nextJobNumber();

  const job = await prisma.turnaroundJob.create({
    data: {
      jobNumber,
      fluidEndId: fluidEnd.id,
      technician,
      status: JOB_STATUS.DRAFT,
      replacedParts: JSON.stringify(parts),
      notes,
      inspectionNotes,
      outcome,
      deliveryMethod,
      receivedByPsi,
      releasedByClient,
      receivedAt: receivedByPsi ? new Date() : null,
      pressureTest: {
        create: {
          testPressurePsi: isNaN(testPressurePsi) ? 0 : testPressurePsi,
          holdTimeMinutes: isNaN(holdTimeMinutes) ? 0 : holdTimeMinutes,
          result,
          gauge,
          testedBy,
        },
      },
      signatures: {
        create: [
          {
            party: PARTY.PSI,
            order: 1,
            signerName: psiName,
            signerRole: "PSI Technician",
            signerEmail: psiEmail,
            token: newToken(),
          },
          {
            party: PARTY.PRO_PETRO,
            order: 2,
            signerName: opName || "Operator Representative",
            signerRole: "Operator Representative",
            signerEmail: opEmail,
            token: newToken(),
          },
        ],
      },
    },
  });

  // Captured nameplate photo (optional).
  const npKey = await saveNameplate(formData, "job", job.id);
  if (npKey) await prisma.turnaroundJob.update({ where: { id: job.id }, data: { nameplatePhotoKey: npKey } });

  // If this work order was started from a client repair request, link them.
  const requestId = str(formData, "requestId");
  if (requestId) {
    await prisma.repairRequest
      .update({
        where: { id: requestId },
        data: { status: REQUEST_STATUS.CONVERTED, jobId: job.id },
      })
      .catch(() => {});
    revalidatePath("/requests");
  }

  revalidatePath("/");
  redirect(`/jobs/${job.id}`);
}

/** Submit a client repair request with the client's authorization signature. */
export async function submitRepairRequest(formData: FormData) {
  const company = str(formData, "company");
  const contactName = str(formData, "contactName");
  const serialNumber = str(formData, "serialNumber");
  const manufacturer = str(formData, "manufacturer");
  const problem = str(formData, "problem");
  const clientSignerName = str(formData, "clientSignerName");

  if (!company || !contactName || !serialNumber || !manufacturer || !problem || !clientSignerName) {
    throw new Error("Company, contact, serial number, manufacturer, problem, and signature are required.");
  }

  const requestNumber = await nextRequestNumber();
  const created = await prisma.repairRequest.create({
    data: {
      requestNumber,
      company,
      contactName,
      contactEmail: str(formData, "contactEmail") || null,
      contactPhone: str(formData, "contactPhone") || null,
      serialNumber,
      manufacturer,
      model: str(formData, "model") || null,
      problem,
      requestedService: str(formData, "requestedService") || null,
      clientSignerName,
      clientSignerTitle: str(formData, "clientSignerTitle") || null,
      deliveryMethod: str(formData, "deliveryMethod") || null,
    },
  });

  const npKey = await saveNameplate(formData, "req", created.id);
  if (npKey) await prisma.repairRequest.update({ where: { id: created.id }, data: { nameplatePhotoKey: npKey } });

  revalidatePath("/requests");
  redirect("/requests?submitted=1");
}

/** Create a chain-of-custody handoff with the client's RELEASE signature. */
export async function createRelease(formData: FormData) {
  const serialNumber = str(formData, "serialNumber");
  const customer = str(formData, "customer");
  const releasedByName = str(formData, "releasedByName");
  if (!serialNumber || !customer || !releasedByName) {
    throw new Error("Serial number, customer, and release signature are required.");
  }
  const handoffNumber = await nextHandoffNumber();
  await prisma.handoff.create({
    data: {
      handoffNumber,
      serialNumber,
      manufacturer: str(formData, "manufacturer") || null,
      customer,
      deliveryMethod: str(formData, "deliveryMethod") || null,
      conditionNotes: str(formData, "conditionNotes") || null,
      releasedByName,
      releasedByTitle: str(formData, "releasedByTitle") || null,
      status: "RELEASED",
      requestId: str(formData, "requestId") || null,
    },
  });
  revalidatePath("/handoffs");
  redirect("/handoffs?released=1");
}

/** PSI signs to RECEIVE a released handoff. */
export async function receiveHandoff(handoffId: string, formData: FormData) {
  const receivedByName = str(formData, "receivedByName");
  if (!receivedByName) throw new Error("Enter your name to sign for receipt.");
  await prisma.handoff.update({
    where: { id: handoffId },
    data: { receivedByName, receivedAt: new Date(), status: "RECEIVED" },
  });
  revalidatePath("/handoffs");
  redirect(`/handoffs/${handoffId}`);
}

/** Route a DRAFT job for signatures (PSI first). */
export async function sendForSignatures(jobId: string) {
  const job = await prisma.turnaroundJob.findUnique({
    where: { id: jobId },
    include: fullJobInclude(),
  });
  if (!job) throw new Error("Job not found.");
  if (job.status !== JOB_STATUS.DRAFT) return;

  const provider = getEsignProvider();
  const tokens: Record<number, string> = {};
  job.signatures.forEach((s) => (tokens[s.order] = s.token));

  const requests = await provider.createRequests({
    jobId: job.id,
    jobNumber: job.jobNumber,
    appBaseUrl: appBaseUrl(),
    signers: job.signatures.map((s) => ({
      party: s.party as "PSI" | "PRO_PETRO",
      order: s.order,
      name: s.signerName,
      role: s.signerRole,
      email: s.signerEmail,
    })),
    tokens,
  });

  // Persist provider references.
  await Promise.all(
    requests.map((r) => {
      const sig = job.signatures.find((s) => s.order === r.order);
      if (!sig) return Promise.resolve();
      return prisma.signature.update({
        where: { id: sig.id },
        data: { providerRef: r.providerRef ?? null },
      });
    })
  );

  await prisma.turnaroundJob.update({
    where: { id: job.id },
    data: { status: JOB_STATUS.AWAITING_PSI },
  });

  revalidatePath(`/jobs/${job.id}`);
  revalidatePath("/");
}

/** Apply a signature via its token. Advances the workflow and, when both
 *  parties have signed, generates the signed certificate and completes the job. */
export async function applySignature(token: string, formData: FormData) {
  const typedName = str(formData, "typedName");
  const sig = await prisma.signature.findUnique({
    where: { token },
    include: { job: { include: fullJobInclude() } },
  });
  if (!sig) throw new Error("Signature link not found.");
  if (sig.status === "SIGNED") {
    redirect(`/sign/${token}?done=1`);
  }

  const job = sig.job;

  // Enforce signing order: PSI (order 1) must sign before Pro Petro (order 2).
  const priorPending = job.signatures.find(
    (s) => s.order < sig.order && s.status !== "SIGNED"
  );
  if (priorPending) {
    throw new Error("The PSI signature is required before the operator can sign.");
  }

  const auditMeta = JSON.stringify({
    providerRef: sig.providerRef || `mock-${job.jobNumber}-${sig.order}`,
    userAgent: str(formData, "_ua") || null,
    method: process.env.ESIGN_PROVIDER || "mock",
  });

  await prisma.signature.update({
    where: { id: sig.id },
    data: {
      status: "SIGNED",
      signedAt: new Date(),
      signerName: typedName || sig.signerName,
      auditMeta,
    },
  });

  // Recompute state.
  const updated = await prisma.turnaroundJob.findUnique({
    where: { id: job.id },
    include: fullJobInclude(),
  });
  if (!updated) throw new Error("Job vanished.");

  const allSigned = updated.signatures.every((s) => s.status === "SIGNED");

  if (allSigned) {
    const completedDate = new Date();
    const certUrl = await generateCertificate({
      jobNumber: updated.jobNumber,
      serialNumber: updated.fluidEnd.serialNumber,
      manufacturer: updated.fluidEnd.manufacturer,
      customer: updated.fluidEnd.customer,
      model: updated.fluidEnd.model,
      technician: updated.technician,
      intakeDate: updated.intakeDate,
      completedDate,
      replacedParts: safeParse(updated.replacedParts),
      notes: updated.notes,
      test: updated.pressureTest,
      signatures: updated.signatures.map((s) => ({
        party: s.party,
        signerName: s.signerName,
        signerRole: s.signerRole,
        signedAt: s.signedAt,
        auditMeta: s.auditMeta,
      })),
    });

    await prisma.turnaroundJob.update({
      where: { id: updated.id },
      data: {
        status: JOB_STATUS.COMPLETED,
        completedDate,
        certificateUrl: certUrl,
      },
    });

    // Issue the invoice (generate its PDF) before notifying, so the completion
    // email can reference the invoice total and link.
    await issueInvoiceForJob(updated.id);

    // Both parties signed — tell the operator the certificate is ready.
    await notifyOperatorCompleted(updated.id);
  } else {
    // Advance to the next pending party.
    const nextPending = updated.signatures.find((s) => s.status !== "SIGNED");
    const awaitingOperator = nextPending && nextPending.party === PARTY.PRO_PETRO;
    await prisma.turnaroundJob.update({
      where: { id: updated.id },
      data: {
        status: awaitingOperator ? JOB_STATUS.AWAITING_OPERATOR : JOB_STATUS.AWAITING_PSI,
      },
    });

    // PSI just signed — surface the work order on the operator (Pro Petro)
    // portal and send the "please countersign" notification + email.
    if (awaitingOperator && sig.party === PARTY.PSI) {
      await notifyOperatorSignRequest(updated.id);
    }
  }

  revalidatePath("/work-orders");
  revalidatePath("/notifications");

  revalidatePath(`/jobs/${job.id}`);
  revalidatePath("/");
  redirect(`/sign/${token}?done=1`);
}

function safeParse(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Invoicing
// ---------------------------------------------------------------------------

/** Default line items for a fresh invoice: a labor line + one line per replaced part. */
function defaultInvoiceItems(replacedParts: string) {
  const parts = safeParse(replacedParts);
  const items: { description: string; quantity: number; unitPriceCents: number; order: number }[] = [
    { description: "Labor — fluid-end service", quantity: 1, unitPriceCents: 0, order: 0 },
  ];
  parts.forEach((p, i) =>
    items.push({ description: `Replace ${PART_LABEL[p] || p}`, quantity: 1, unitPriceCents: 0, order: i + 1 })
  );
  return items;
}

/** Build the data object and (re)render the invoice PDF; returns the served path. */
async function renderInvoice(invoiceId: string): Promise<string | null> {
  const inv = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      items: { orderBy: { order: "asc" } },
      job: { include: { fluidEnd: true, signatures: true } },
    },
  });
  if (!inv) return null;
  const opSig = inv.job.signatures.find((s) => s.party === PARTY.PRO_PETRO);
  const url = await generateInvoicePdf({
    invoiceNumber: inv.invoiceNumber,
    issuedAt: inv.issuedAt || new Date(),
    currency: inv.currency,
    terms: inv.terms,
    poNumber: inv.poNumber,
    notes: inv.notes,
    taxRatePct: inv.taxRatePct,
    billToCompany: inv.job.fluidEnd.customer,
    billToContact: opSig?.signerName || null,
    jobNumber: inv.job.jobNumber,
    serialNumber: inv.job.fluidEnd.serialNumber,
    manufacturer: inv.job.fluidEnd.manufacturer,
    completedDate: inv.job.completedDate,
    items: inv.items.map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
    })),
  });
  return url;
}

/** PSI saves/updates the invoice for a work order (line items, tax, terms, notes). */
export async function saveInvoice(jobId: string, formData: FormData) {
  const job = await prisma.turnaroundJob.findUnique({
    where: { id: jobId },
    include: { invoice: true },
  });
  if (!job) throw new Error("Work order not found.");

  const descs = formData.getAll("desc").map(String);
  const qtys = formData.getAll("qty").map(String);
  const prices = formData.getAll("price").map(String);

  const items = descs
    .map((description, i) => ({
      description: description.trim(),
      quantity: parseFloat(qtys[i] || "1") || 0,
      unitPriceCents: dollarsToCents(prices[i]),
      order: i,
    }))
    .filter((it) => it.description.length > 0);

  const taxRatePct = parseFloat(str(formData, "taxRatePct") || "0") || 0;
  const terms = str(formData, "terms") || "Net 30";
  const poNumber = str(formData, "poNumber") || null;
  const notes = str(formData, "notes") || null;

  // Upsert the invoice, then replace its line items.
  let invoiceId = job.invoice?.id;
  if (!invoiceId) {
    const created = await prisma.invoice.create({
      data: { jobId, invoiceNumber: await nextInvoiceNumber(), taxRatePct, terms, poNumber, notes },
    });
    invoiceId = created.id;
  } else {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { taxRatePct, terms, poNumber, notes },
    });
    await prisma.invoiceItem.deleteMany({ where: { invoiceId } });
  }
  if (items.length) {
    await prisma.invoiceItem.createMany({
      data: items.map((it) => ({ ...it, invoiceId: invoiceId! })),
    });
  }

  // If the invoice was already issued, regenerate the PDF so it stays in sync.
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (inv?.status === INVOICE_STATUS.ISSUED) {
    const url = await renderInvoice(invoiceId);
    if (url) await prisma.invoice.update({ where: { id: invoiceId }, data: { pdfUrl: url } });
  }

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/work-orders");
}

/** Ensure an issued invoice + PDF exists for a completed work order. */
async function issueInvoiceForJob(jobId: string) {
  const job = await prisma.turnaroundJob.findUnique({
    where: { id: jobId },
    include: { invoice: true },
  });
  if (!job) return;

  let invoiceId = job.invoice?.id;
  if (!invoiceId) {
    // No invoice drafted — create one with default line items (at $0) so there is
    // always an invoice to issue. PSI can fill amounts and re-issue afterward.
    const created = await prisma.invoice.create({
      data: {
        jobId,
        invoiceNumber: await nextInvoiceNumber(),
        items: { create: defaultInvoiceItems(job.replacedParts) },
      },
    });
    invoiceId = created.id;
  }

  const issuedAt = job.invoice?.issuedAt || new Date();
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: INVOICE_STATUS.ISSUED, issuedAt },
  });
  const url = await renderInvoice(invoiceId);
  if (url) await prisma.invoice.update({ where: { id: invoiceId }, data: { pdfUrl: url } });
}
