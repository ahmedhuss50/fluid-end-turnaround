import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Serves a captured nameplate photo: /nameplate/job/<id> or /nameplate/request/<id>
export async function GET(
  _req: Request,
  { params }: { params: { scope: string; id: string } }
) {
  const scope = params.scope === "request" ? "req" : "job";
  const id = params.id.replace(/[^A-Za-z0-9_-]/g, "");
  const key = `nameplates/${scope}-${id}.jpg`;
  const res = await getStorage().getObject(key);
  if (!res) return new Response("Not found", { status: 404 });
  if (res.kind === "redirect") return Response.redirect(res.url, 302);
  return new Response(res.data, {
    status: 200,
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=60" },
  });
}
