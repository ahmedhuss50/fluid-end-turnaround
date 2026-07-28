import { chromium } from "playwright-core";

// End-to-end smoke test of the turnaround → dual-signature → certificate flow.
// Requires the app running on BASE and a Chromium binary. Set CHROME_EXECUTABLE
// to your Chromium/Chrome path, or run `npx playwright install chromium` first.
const EXE = process.env.CHROME_EXECUTABLE || undefined;
const BASE = process.env.BASE_URL || "http://localhost:3000";

function ok(cond, msg) {
  if (!cond) throw new Error("ASSERT FAILED: " + msg);
  console.log("  ✓ " + msg);
}

const browser = await chromium.launch(
  EXE ? { executablePath: EXE, args: ["--no-sandbox"] } : { args: ["--no-sandbox"] }
);
const page = await browser.newPage();

// Click a server-action submit button and wait for the POST to complete.
async function submit(locator) {
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST").catch(() => {}),
    locator.click(),
  ]);
  await page.waitForLoadState("networkidle").catch(() => {});
}

const log = [];
page.on("pageerror", (e) => log.push("PAGEERROR " + e.message));
page.on("response", (r) => { if (r.status() >= 500) log.push("HTTP " + r.status() + " " + r.url()); });

try {
  // 1. Dashboard
  await page.goto(BASE, { waitUntil: "networkidle" });
  ok(await page.getByText("Turnaround dashboard").count() > 0, "dashboard loads");
  // Find a DRAFT job: scan job links, open each, stop at the first with a Send button.
  const hrefs = await page.locator('a.mono[href^="/jobs/"]').evaluateAll((els) =>
    els.map((e) => e.getAttribute("href"))
  );
  ok(hrefs.length > 0, "dashboard lists job links (" + hrefs.length + ")");
  let jobUrl = null;
  let sendBtn = null;
  for (const h of hrefs) {
    await page.goto(BASE + h, { waitUntil: "networkidle" });
    const b = page.getByRole("button", { name: /Send for signatures/i });
    if (await b.count() > 0) { jobUrl = BASE + h; sendBtn = b; break; }
  }
  ok(!!sendBtn, "found a draft job showing Send for signatures");

  // 2. Send for signatures
  await submit(sendBtn);
  await page.goto(jobUrl, { waitUntil: "networkidle" });
  ok(await page.getByText(/Awaiting PSI signature/i).count() > 0, "status advanced to Awaiting PSI");

  // 3. Grab the PSI signing link and sign
  const psiLink = await page.locator('a', { hasText: /Open signing page/i }).first().getAttribute("href");
  ok(!!psiLink, "PSI signing link present");
  await page.goto(BASE + psiLink, { waitUntil: "networkidle" });
  ok(await page.getByText(/PSI signature/i).count() > 0, "PSI signing page loads");
  await submit(page.getByRole("button", { name: /Sign & accept/i }));
  await page.goto(BASE + psiLink, { waitUntil: "networkidle" });
  ok(await page.getByText(/Signed\./i).count() > 0, "PSI signature recorded");

  // 4. Back to job — operator link should now be available
  await page.goto(jobUrl, { waitUntil: "networkidle" });
  ok(await page.getByText(/Awaiting operator signature/i).count() > 0, "status advanced to Awaiting operator");
  const opLink = await page.locator('a', { hasText: /Open signing page/i }).first().getAttribute("href");
  ok(!!opLink, "operator signing link present");

  // 5. Operator signs -> triggers certificate
  await page.goto(BASE + opLink, { waitUntil: "networkidle" });
  await submit(page.getByRole("button", { name: /Sign & accept/i }));
  await page.goto(BASE + opLink, { waitUntil: "networkidle" });
  ok(await page.getByText(/certificate has been issued/i).count() > 0, "operator signed; certificate issued");

  // 6. Job now completed with a downloadable certificate
  await page.goto(jobUrl, { waitUntil: "networkidle" });
  ok(await page.getByText(/Completed/i).count() > 0, "job marked Completed");
  const certHref = await page.locator('a', { hasText: /Download certificate/i }).first().getAttribute("href");
  ok(!!certHref && certHref.startsWith("/certificate/"), "certificate download link present: " + certHref);

  // 7. Fetch the PDF and check it's a real PDF
  const res = await page.request.get(BASE + certHref);
  const buf = await res.body();
  ok(res.status() === 200, "certificate PDF served 200");
  ok(buf.slice(0, 5).toString() === "%PDF-", "certificate is a valid PDF (" + buf.length + " bytes)");

  if (log.length) { console.log("\nServer/page issues:\n" + log.join("\n")); throw new Error("issues detected"); }
  console.log("\nALL SMOKE TESTS PASSED");
} catch (e) {
  console.error("\nSMOKE TEST FAILED:", e.message);
  if (log.length) console.error(log.join("\n"));
  process.exitCode = 1;
} finally {
  await browser.close();
}
