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

// All PSI staff. Shared starting password — users can change it in the app.
const DEFAULT_PASSWORD = "Welcome@123";
const USERS = [
  { email: "josh@innuvis.com", name: "Josh", role: "psi", company: null },
  { email: "support@elevatemybusiness.co", name: "Ahmed", role: "psi", company: null },
  { email: "mike@psiofc.com", name: "Mike", role: "psi", company: null },
  { email: "almodovajacob.23@gmail.com", name: "Jacob", role: "psi", company: null },
];

// "Those are the only users I want" — remove any accounts not in the list above.
const keep = USERS.map((u) => u.email);
const removed = await prisma.user.deleteMany({ where: { email: { notIn: keep } } });
if (removed.count) console.log(`Removed ${removed.count} account(s) not in the list.`);

for (const u of USERS) {
  await prisma.user.upsert({
    where: { email: u.email },
    // Only set the password on create, so re-running the seed doesn't reset a
    // password a user has already changed.
    update: { name: u.name, role: u.role, company: u.company },
    create: { email: u.email, name: u.name, role: u.role, company: u.company, passwordHash: hashPassword(DEFAULT_PASSWORD) },
  });
  console.log(`Seeded ${u.role} account: ${u.email}`);
}

await prisma.$disconnect();
console.log("Done.");
