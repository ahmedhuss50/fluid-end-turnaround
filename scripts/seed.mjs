// Seeds demo data: a few fluid ends and turnarounds in various states.
// Run with: npm run db:seed   (or `npm run setup` to push schema + seed)
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

const prisma = new PrismaClient();
const token = () => crypto.randomBytes(24).toString("base64url");

async function main() {
  // Clean slate (dev only).
  await prisma.signature.deleteMany();
  await prisma.pressureTest.deleteMany();
  await prisma.turnaroundJob.deleteMany();
  await prisma.fluidEnd.deleteMany();

  const units = [
    { serialNumber: "FE-2200-00841", manufacturer: "SPM", customer: "Pro Petro", model: "QWS-2500 5x8" },
    { serialNumber: "FE-2200-00907", manufacturer: "Gardner Denver", customer: "Pro Petro", model: "GD-3000" },
    { serialNumber: "FE-1500-00218", manufacturer: "SPM", customer: "Pro Petro", model: "QEM-3000" },
  ];
  const created = {};
  for (const u of units) created[u.serialNumber] = await prisma.fluidEnd.create({ data: u });

  const year = new Date().getUTCFullYear();
  let seq = 0;
  const jobNo = () => `TA-${year}-${String(++seq).padStart(4, "0")}`;

  // 1) Draft
  await prisma.turnaroundJob.create({
    data: {
      jobNumber: jobNo(),
      fluidEndId: created["FE-2200-00841"].id,
      technician: "Jacob Ramirez",
      status: "DRAFT",
      replacedParts: JSON.stringify(["valves", "seats", "packing", "plungers"]),
      notes: "Moderate washout on #2 bore; seats replaced. Ready to route for sign-off.",
      pressureTest: {
        create: { testPressurePsi: 15000, holdTimeMinutes: 10, result: "PASS", gauge: "Transducer #4", testedBy: "Jacob Ramirez" },
      },
      signatures: {
        create: [
          { party: "PSI", order: 1, signerName: "Jacob Ramirez", signerRole: "PSI Technician", token: token() },
          { party: "PRO_PETRO", order: 2, signerName: "D. Cole", signerRole: "Operator Representative", token: token() },
        ],
      },
    },
  });

  // 2) Awaiting PSI signature (already sent)
  await prisma.turnaroundJob.create({
    data: {
      jobNumber: jobNo(),
      fluidEndId: created["FE-2200-00907"].id,
      technician: "Marcus Hill",
      status: "AWAITING_PSI",
      replacedParts: JSON.stringify(["seals", "packing", "studs", "nuts"]),
      notes: "Full wear-part refresh. Pressure test held clean.",
      pressureTest: {
        create: { testPressurePsi: 12000, holdTimeMinutes: 15, result: "PASS", gauge: "Transducer #2", testedBy: "Marcus Hill" },
      },
      signatures: {
        create: [
          { party: "PSI", order: 1, signerName: "Marcus Hill", signerRole: "PSI Technician", token: token() },
          { party: "PRO_PETRO", order: 2, signerName: "R. Nguyen", signerRole: "Operator Representative", token: token() },
        ],
      },
    },
  });

  // 3) Failed test, draft — shows a fail path
  await prisma.turnaroundJob.create({
    data: {
      jobNumber: jobNo(),
      fluidEndId: created["FE-1500-00218"].id,
      technician: "Jacob Ramirez",
      status: "DRAFT",
      replacedParts: JSON.stringify(["valves", "springs"]),
      notes: "Leak detected at test — bore inspection required before re-test.",
      pressureTest: {
        create: { testPressurePsi: 9000, holdTimeMinutes: 5, result: "FAIL", gauge: "Transducer #4", testedBy: "Jacob Ramirez" },
      },
      signatures: {
        create: [
          { party: "PSI", order: 1, signerName: "Jacob Ramirez", signerRole: "PSI Technician", token: token() },
          { party: "PRO_PETRO", order: 2, signerName: "D. Cole", signerRole: "Operator Representative", token: token() },
        ],
      },
    },
  });

  console.log(`Seeded ${units.length} fluid ends and ${seq} turnarounds.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
