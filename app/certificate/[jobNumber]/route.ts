import { getStorage } from "@/lib/storage";

// Serve certificate PDFs from the configured storage driver.
// Runs on the Node.js runtime (uses server-only storage clients).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { jobNumber: string } }
) {
  const jobNumber = decodeURIComponent(params.jobNumber).replace(/[^A-Za-z0-9._-]/g, "");
  const result = await getStorage().get(jobNumber);

  if (!result) return new Response("Certificate not found", { status: 404 });

  if (result.kind === "redirect") {
    return Response.redirect(result.url, 302);
  }

  return new Response(result.data, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${jobNumber}.pdf"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
