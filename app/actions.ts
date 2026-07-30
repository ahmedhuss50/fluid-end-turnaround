"use server";

import { prisma } from "@/lib/db";
import { JOB_STATUS, PARTY, TEST_RESULT, REQUEST_STATUS, STAGE_ORDER } from "@/lib/constants";
import { nextJobNumber, nextRequestNumber, nextHandoffNumber, newToken, appBaseUrl, fullJobInclude } from "@/lib/jobs";
import { getEsignProvider } from "@/lib/esign";
import { getStorage } from "@/lib/storage";
import { generateCertificate } from "@/lib/certificate";
import { notifyOperatorSignRequest, notifyOperatorCompleted } from "@/lib/notify";

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

/** Switch the current view between PSI and client (Pro Petro). */
export async function setRole(role: string) {
  cookies().set("role", role === "client" ? "client" : "psi", { path: "/", maxAge: 60 * 60 * 24 * 30 });
  revalidatePath("/", "layout");
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
