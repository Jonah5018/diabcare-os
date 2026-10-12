export const dynamic = "force-dynamic";

// Liveness only: no patient data, credentials, or database details are exposed.
export async function GET() {
  return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
