import { prisma } from "./db";
import crypto from "node:crypto";

/** Generates the next human-friendly job number, e.g. TA-2026-0007. */
export async function nextJobNumber(): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `TA-${year}-`;
  const last = await prisma.turnaroundJob.findFirst({
    where: { jobNumber: { startsWith: prefix } },
    orderBy: { jobNumber: "desc" },
    select: { jobNumber: true },
  });
  const n = last ? parseInt(last.jobNumber.slice(prefix.length), 10) + 1 : 1;
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
  };
}

export function appBaseUrl(): string {
  return process.env.APP_BASE_URL || "http://localhost:3000";
}
