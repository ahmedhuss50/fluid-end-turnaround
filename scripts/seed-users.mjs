// Seeds the demo login accounts (idempotent — safe to re-run).
// Run once against your database: `node scripts/seed-users.mjs`
import { PrismaClient } from "@prisma/client";
import { scryptSync, randomBytes } from "node:crypto";

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const USERS = [
  { email: "jacob@psi.com", name: "Jacob Ramirez", role: "psi", company: null, password: "psi12345" },
  { email: "sam@propetro.com", name: "Sam Operator", role: "client", company: "Pro Petro", password: "propetro12345" },
];

for (const u of USERS) {
  await prisma.user.upsert({
    where: { email: u.email },
    update: { name: u.name, role: u.role, company: u.company, passwordHash: hashPassword(u.password) },
    create: { email: u.email, name: u.name, role: u.role, company: u.company, passwordHash: hashPassword(u.password) },
  });
  console.log(`Seeded ${u.role} account: ${u.email} / ${u.password}`);
}

await prisma.$disconnect();
console.log("Done.");
