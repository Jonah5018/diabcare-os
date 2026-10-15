import { authorizeOperations } from "@/lib/operations/security";
import { createOperationsClient } from "@/lib/supabase/operations";
import { emitOperationalEvent, newRequestId } from "@/lib/observability/events";

export async function GET(request: Request) {
  const requestId = newRequestId();
  const headers = { "Cache-Control": "no-store", "X-Request-ID": requestId };
  if (!authorizeOperations(request)) return new Response("Not found", { status: 404, headers });
  const started = Date.now();
  try {
    const { data, error } = await createOperationsClient().rpc("operations_readiness_probe")
      .abortSignal(AbortSignal.timeout(5000));
    if (error || data?.database !== "ok" || !data.queue_schema || !data.billing_schema) throw new Error("Readiness probe failed");
    return Response.json({ status: "ready", request_id: requestId }, { headers });
  } catch {
    emitOperationalEvent({ event: "readiness_probe", request_id: requestId, outcome: "unavailable", duration_ms: Date.now() - started });
    return Response.json({ status: "unavailable", request_id: requestId }, { status: 503, headers });
  }
}
