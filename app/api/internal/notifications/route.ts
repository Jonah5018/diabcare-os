import { authorizeOperations } from "@/lib/operations/security";
import { createOperationsClient } from "@/lib/supabase/operations";
import { runNotificationBatch } from "@/lib/notifications/worker";
import { emitOperationalEvent, newRequestId } from "@/lib/observability/events";

// GET supports a protected hosting scheduler; no cookie authentication is used.
export async function GET(request: Request) {
  const requestId = newRequestId();
  const headers = { "Cache-Control": "no-store", "X-Request-ID": requestId };
  if (!authorizeOperations(request)) return new Response("Not found", { status: 404, headers });
  const started = Date.now();
  try {
    const result = await runNotificationBatch(createOperationsClient());
    if (result.claimed > 0 || result.uncertain > 0) {
      emitOperationalEvent({ event: "notification_batch", request_id: requestId,
        outcome: result.uncertain ? "uncertain" : "ok", count: result.claimed, duration_ms: Date.now() - started });
    }
    return Response.json(result, { headers });
  } catch {
    emitOperationalEvent({ event: "notification_batch", request_id: requestId, outcome: "failed", duration_ms: Date.now() - started });
    return new Response("Notification processor unavailable", { status: 503, headers });
  }
}

export const POST = GET;
