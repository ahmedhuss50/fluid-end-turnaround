import { getStorage } from "@/lib/storage";

// Serve invoice PDFs from the configured storage driver.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { invoiceNumber: string } }
) {
  const num = decodeURIComponent(params.invoiceNumber).replace(/[^A-Za-z0-9._-]/g, "");
  const res = await getStorage().getObject(`invoices/${num}.pdf`);
  if (!res) return new Response("Invoice not found", { status: 404 });
  if (res.kind === "redirect") return Response.redirect(res.url, 302);
  return new Response(res.data, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${num}.pdf"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
