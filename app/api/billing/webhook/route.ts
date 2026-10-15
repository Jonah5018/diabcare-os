import { boundedRequestText } from "@/lib/http/body";
import { configuredBillingProvider } from "@/lib/billing/provider";
import { billingEventFingerprint } from "@/lib/billing/fingerprint";
import { createOperationsClient } from "@/lib/supabase/operations";
import { emitOperationalEvent, newRequestId } from "@/lib/observability/events";

export async function POST(request: Request) {
  const requestId = newRequestId();
  const started = Date.now();
  const headers = { "Cache-Control": "no-store", "X-Request-ID": requestId };
  try {
    const provider = configuredBillingProvider();
    if (!provider) return new Response("Billing webhook is disabled", { status: 503, headers });
    const body = await boundedRequestText(request);
    const event = provider.verifyAndNormalize(body, request.headers.get("stripe-signature") ?? "", Math.floor(Date.now() / 1000));
    if (!event) return Response.json({ received: true, ignored: true }, { headers });
    const backend = createOperationsClient();
    const { data, error } = await backend.rpc("ingest_billing_webhook", {
      p_provider: event.provider, p_event: event.id, p_hash: billingEventFingerprint(event),
      p_customer: event.customer, p_subscription: event.subscription, p_plan: event.plan,
      p_status: event.status, p_time: event.occurredAt, p_trial_end: event.trialEndsAt, p_period_end: event.periodEndsAt,
    });
    if (error) {
      emitOperationalEvent({ event: "billing_webhook", request_id: requestId, outcome: "unavailable", duration_ms: Date.now() - started });
      return new Response("Billing event could not be persisted", { status: 503, headers });
    }
    emitOperationalEvent({ event: "billing_webhook", request_id: requestId,
      outcome: ["unmatched", "needs_reconciliation"].includes(data) ? "uncertain" : "ok", duration_ms: Date.now() - started });
    return Response.json({ received: true, result: data }, { headers });
  } catch {
    emitOperationalEvent({ event: "billing_webhook", request_id: requestId, outcome: "rejected", duration_ms: Date.now() - started });
    return new Response("Billing event rejected; verify its signature, supported price and configuration", { status: 400, headers });
  }
}
