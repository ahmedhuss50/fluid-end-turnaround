import { prisma } from "./db";
import crypto from "node:crypto";

/** Generates the next human-friendly job number, e.g. WO-2026-0007. */
export async function nextJobNumber(): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `WO-${year}-`;
  const last = await prisma.turnaroundJob.findFirst({
    where: { jobNumber: { startsWith: prefix } },
    orderBy: { jobNumber: "desc" },
    select: { jobNumber: true },
  });
  const n = last ? parseInt(last.jobNumber.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(n).padStart(4, "0")}`;
}

/** Generates the next repair-request number, e.g. RR-2026-0007. */
export async function nextRequestNumber(): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `RR-${year}-`;
  const last = await prisma.repairRequest.findFirst({
    where: { requestNumber: { startsWith: prefix } },
    orderBy: { requestNumber: "desc" },
    select: { requestNumber: true },
  });
  const n = last ? parseInt(last.requestNumber.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(n).padStart(4, "0")}`;
}

/** Generates the next invoice number, e.g. INV-2026-0007. */
export async function nextInvoiceNumber(): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `INV-${year}-`;
  const last = await prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });
  const n = last ? parseInt(last.invoiceNumber.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(n).padStart(4, "0")}`;
}

/** Generates the next batch-request number, e.g. RB-2026-0007. */
export async function nextBatchNumber(): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `RB-${year}-`;
  const last = await prisma.requestBatch.findFirst({
    where: { batchNumber: { startsWith: prefix } },
    orderBy: { batchNumber: "desc" },
    select: { batchNumber: true },
  });
  const n = last ? parseInt(last.batchNumber.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(n).padStart(4, "0")}`;
}

/** Generates the next handoff number, e.g. HO-2026-0007. */
export async function nextHandoffNumber(): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `HO-${year}-`;
  const last = await prisma.handoff.findFirst({
    where: { handoffNumber: { startsWith: prefix } },
    orderBy: { handoffNumber: "desc" },
    select: { handoffNumber: true },
  });
  const n = last ? parseInt(last.handoffNumber.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(n).padStart(4, "0")}`;
}

export function newToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export function fullJobInclude() {
  return {
    fluidEnd: true,
    pressureTest: true,
    signatures: { orderBy: { order: "asc" as const } },
    extraUnits: { orderBy: { order: "asc" as const } },
  };
}

export function appBaseUrl(): string {
  return process.env.APP_BASE_URL || "http://localhost:3000";
}
